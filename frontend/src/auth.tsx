import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, isSessionRejected, signInMode, SignInMode, tokenStore, User, Session } from './api';
import { claimDevice, clearPersonalData, createAuthChannel, pendingLogout, withRefreshLock } from './sessionSync';

interface AuthState {
  user: User | null;
  /** False until the first session check finishes; render neutral placeholders, not "Sign in", until then. */
  ready: boolean;
  error: string;
  /** Increments whenever this tab is signed out (here or in another tab), so the shell can leave private pages. */
  signedOutCount: number;
  /** "keycloak": sign in on the Keycloak page (see keycloakUrl); "password": the in-app form and login(). Null until known. */
  signInMode: SignInMode | null;
  login: (email: string, password: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  applyUser: (next: User) => void;
  /** Never throws: the local sign-out always completes, and an unfinished server call is retried on next load. */
  logout: () => Promise<void>;
  /** Ends every session for this account on all devices. Throws if the Profile Manager cannot do it. */
  logoutEverywhere: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);

const channel = createAuthChannel();
// A session another tab refreshed moments ago; reused instead of spending the rotating cookie again.
let shared: { session: Session; at: number } | null = null;
let refreshing: Promise<Session> | null = null;
// While this tab signs out, ignore sessions other tabs broadcast from refreshes that began before the sign-out.
let signOutInProgress = false;

/** One refresh at a time per tab (StrictMode, timer, focus) and, through the Web Lock, across tabs. */
function refreshSession() {
  refreshing ??= withRefreshLock(async () => {
    if (shared && Date.now() - shared.at < 30_000) return shared.session;
    const session = await api.refresh();
    shared = { session, at: Date.now() };
    channel.post({ type: 'session', session });
    return session;
  }).finally(() => { refreshing = null; });
  return refreshing;
}

/**
 * Revokes the server session under the refresh lock, so it runs after any refresh another tab already started
 * and revokes the newest cookie. Other tabs are told only afterwards, so none can adopt a session minted
 * by a refresh that raced the sign-out.
 */
async function finishServerLogout(serverCall: () => Promise<unknown> = api.logout) {
  signOutInProgress = true;
  pendingLogout.set();
  try {
    await withRefreshLock(async () => {
      try { await serverCall(); pendingLogout.clear(); }
      catch (cause) { if (serverCall !== api.logout) throw cause; /* Kept pending: retried on the next load. */ }
    });
    channel.post({ type: 'logout' });
  } finally {
    signOutInProgress = false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [signedOutCount, setSignedOutCount] = useState(0);
  const [mode, setMode] = useState<SignInMode | null>(null);
  const signingOut = useRef(false);

  useEffect(() => { void signInMode().then(setMode); }, []);

  const accept = useCallback((session: Session) => {
    if (signingOut.current) return;
    claimDevice(session.user.id);
    tokenStore.set(session.token);
    setUser(session.user);
    setError('');
  }, []);

  const signOutHere = useCallback((message = '') => {
    signingOut.current = true;
    shared = null;
    tokenStore.set(null);
    setUser(null);
    clearPersonalData();
    setError(message);
    setSignedOutCount(count => count + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const onRefreshFailure = (cause: unknown, message: string) => {
      if (!active) return;
      // A temporary outage keeps the learner signed in; the next tick or focus retries.
      if (isSessionRejected(cause)) signOutHere(message);
    };

    void (async () => {
      if (pendingLogout.get()) {
        await finishServerLogout();
        if (active) { tokenStore.set(null); setReady(true); }
        return;
      }
      try {
        const session = await refreshSession();
        if (active) accept(session);
      } catch {
        if (active) { tokenStore.set(null); setUser(null); }
      } finally {
        if (active) setReady(true);
      }
    })();

    const update = (message: string) => {
      if (!tokenStore.get() || signingOut.current) return;
      void refreshSession().then(session => { if (active) accept(session); })
        .catch(cause => onRefreshFailure(cause, message));
    };
    const timer = window.setInterval(() => update('Your session ended. Sign in again to continue.'), 180_000);
    const onFocus = () => update('');
    window.addEventListener('focus', onFocus);

    const unsubscribe = channel.subscribe(message => {
      if (!active) return;
      if (message.type === 'logout') { if (tokenStore.get()) signOutHere(); return; }
      if (signOutInProgress) return;
      // Another tab refreshed or signed in: adopt its session, including a sign-in after this tab signed out.
      shared = { session: message.session, at: Date.now() };
      signingOut.current = false;
      accept(message.session);
      setReady(true);
    });

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      unsubscribe();
    };
  }, [accept, signOutHere]);

  const value = useMemo<AuthState>(() => ({
    user, ready, error, signedOutCount, signInMode: mode,
    login: async (email, password) => {
      const session = await api.login(email, password);
      signingOut.current = false;
      pendingLogout.clear();
      shared = { session, at: Date.now() };
      accept(session);
      channel.post({ type: 'session', session });
    },
    refreshUser: async () => { setUser(await api.me()); },
    // Keeps the signed-in user in step after a change, e.g. saved reader preferences.
    applyUser: (next: User) => setUser(next),
    logout: async () => {
      signOutHere();
      await finishServerLogout();
    },
    logoutEverywhere: async () => {
      // Throws, leaving this tab signed in, if the Profile Manager could not end the other sessions.
      try { await finishServerLogout(api.logoutEverywhere); }
      catch (cause) { pendingLogout.clear(); throw cause; }
      signOutHere();
    },
  }), [user, ready, error, signedOutCount, mode, accept, signOutHere]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
