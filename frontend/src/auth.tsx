import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, tokenStore, User, Session } from './api';

interface AuthState {
  user: User | null;
  ready: boolean;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);
// Share refreshes across StrictMode mounts and concurrent callers: refresh tokens rotate.
let refreshing: Promise<Session> | null = null;
function refreshSession() {
  refreshing ??= api.refresh().finally(() => { refreshing = null; });
  return refreshing;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const signingOut = useRef(false);
  const accept = useCallback((session: Session) => {
    tokenStore.set(session.token);
    setUser(session.user);
    setError('');
  }, []);

  useEffect(() => {
    let active = true;
    void refreshSession().then(session => { if (active && !signingOut.current) accept(session); }).catch(() => {
      if (active) { tokenStore.set(null); setUser(null); }
    }).finally(() => { if (active) setReady(true); });
    const timer = window.setInterval(() => {
      if (!tokenStore.get()) return;
      void refreshSession().then(session => { if (active && !signingOut.current) accept(session); }).catch(() => {
        if (active) { tokenStore.set(null); setUser(null); setError('Your session ended. Sign in again to continue.'); }
      });
    }, 180_000);
    const update = () => {
      if (tokenStore.get()) void refreshSession().then(session => { if (active && !signingOut.current) accept(session); }).catch(() => {
        if (active) { tokenStore.set(null); setUser(null); }
      });
    };
    window.addEventListener('focus', update);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, [accept]);

  return <AuthContext.Provider value={{ user, ready, error,
    login: async (email, password) => { signingOut.current = false; accept(await api.login(email, password)); },
    refreshUser: async () => { setUser(await api.me()); },
    logout: async () => {
      signingOut.current = true;
      tokenStore.set(null); setUser(null);
      if (refreshing) await refreshing.catch(() => {});
      try { await api.logout(); }
      finally { tokenStore.set(null); setUser(null); }
    },
  }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
