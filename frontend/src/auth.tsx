import Keycloak from 'keycloak-js';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api, tokenStore, User } from './api';

interface AuthState {
  user: User | null;
  ready: boolean;
  error: string;
  login: () => Promise<void>;
  loginWith: (provider: 'google' | 'github') => Promise<void>;
  register: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const profileUrl = (import.meta.env.VITE_PROFILE_MANAGER_URL || 'https://profile.sarvaikam.com').replace(/\/$/, '');
const keycloak = new Keycloak({ url: profileUrl, realm: 'sarvaikam', clientId: 'sarvaikam-learn' });
let initialization: Promise<boolean> | undefined;

function initializeKeycloak() {
  initialization ??= keycloak.init({
    onLoad: 'check-sso',
    checkLoginIframe: false,
    pkceMethod: 'S256',
    silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
  });
  return initialization;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const syncProfile = async () => {
      if (!active) return;
      if (!keycloak.token) throw new Error('The profile manager did not return an access token');
      const session = await api.exchangeProfileToken(keycloak.token);
      if (!active) return;
      tokenStore.set(session.token);
      setUser(session.user);
      setError('');
    };

    void initializeKeycloak()
      .then(async (authenticated) => {
        if (authenticated) await syncProfile();
        else tokenStore.set(null);
        if (active) setReady(true);
      })
      .catch((cause: unknown) => {
        if (active) {
          tokenStore.set(null);
          setUser(null);
          setError(cause instanceof Error ? cause.message : 'Could not connect to the profile manager');
          setReady(true);
        }
      });

    const refresh = window.setInterval(async () => {
      if (!active || !keycloak.authenticated) return;
      try {
        if (await keycloak.updateToken(45)) await syncProfile();
      } catch (cause) {
        if (active) {
          tokenStore.set(null);
          setUser(null);
          setError(cause instanceof Error ? cause.message : 'Your sign-in session could not be refreshed');
        }
      }
    }, 30_000);

    return () => {
      active = false;
      window.clearInterval(refresh);
    };
  }, []);

  const value: AuthState = {
    user,
    ready,
    error,
    login: async () => {
      setError('');
      await keycloak.login({ redirectUri: window.location.href });
    },
    loginWith: async (provider) => {
      setError('');
      await keycloak.login({ idpHint: provider, redirectUri: window.location.href });
    },
    register: async () => {
      setError('');
      await keycloak.register({ redirectUri: window.location.href });
    },
    logout: () => {
      tokenStore.set(null);
      setUser(null);
      void keycloak.logout({ redirectUri: window.location.origin }).catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Could not sign out from the profile manager');
      });
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
