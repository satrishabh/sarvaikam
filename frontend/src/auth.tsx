import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api, tokenStore, User } from './api';

interface AuthState {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!tokenStore.get()) return;
    api.me().then(setUser).catch(() => tokenStore.set(null));
  }, []);

  const accept = ({ token, user }: { token: string; user: User }) => {
    tokenStore.set(token);
    setUser(user);
  };

  const value: AuthState = {
    user,
    login: async (email, password) => accept(await api.login(email, password)),
    register: async (email, name, password) => accept(await api.register(email, name, password)),
    logout: () => {
      tokenStore.set(null);
      setUser(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
