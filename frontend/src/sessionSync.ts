import type { Session } from './api';

/**
 * Cross-tab session coordination and device hygiene.
 *
 * - Refreshes run under a Web Lock so only one tab at a time spends the rotating refresh cookie.
 * - Tabs share fresh sessions and sign-outs over a BroadcastChannel (storage-event fallback).
 * - Personal learning data in this browser is wiped on sign-out, and when a different account signs in,
 *   so the next person on a shared or lab computer never sees it.
 */

export type AuthMessage = { type: 'session'; session: Session } | { type: 'logout' };

const CHANNEL = 'sarvaikam.auth';
const LOCK = 'sarvaikam.auth.refresh';
const OWNER_KEY = 'sarvaikam.owner';
const PENDING_LOGOUT_KEY = 'sarvaikam.logout.pending';
const FALLBACK_KEY = 'sarvaikam.auth.message';

/** Browser keys that hold one learner's activity. Reader display preferences are device settings and stay. */
const PERSONAL_EXACT = ['sarvaikam.token', 'sarvaikam.reader.resume.v1', 'sarvaikam.dailyGoal'];
const PERSONAL_PREFIXES = ['sarvaikam.practice.v1.'];

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

function storage(): KeyValueStore | null {
  try { return window.localStorage; } catch { return null; }
}

export function isPersonalKey(key: string) {
  return PERSONAL_EXACT.includes(key) || PERSONAL_PREFIXES.some(prefix => key.startsWith(prefix));
}

export function clearPersonalData(store: KeyValueStore | null = storage()) {
  if (!store) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && isPersonalKey(key)) keys.push(key);
    }
    keys.forEach(key => store.removeItem(key));
    store.removeItem(OWNER_KEY);
  } catch { /* Storage can be blocked; nothing personal could have been written either. */ }
}

/** Records which account owns this browser's learning data, clearing a previous account's data first. */
export function claimDevice(userId: string, store: KeyValueStore | null = storage()) {
  if (!store) return;
  try {
    const owner = store.getItem(OWNER_KEY);
    if (owner && owner !== userId) clearPersonalData(store);
    store.setItem(OWNER_KEY, userId);
  } catch { /* best effort */ }
}

/** A sign-out whose server call did not finish is retried on the next load, before any refresh. */
export const pendingLogout = {
  get: (store: KeyValueStore | null = storage()) => { try { return store?.getItem(PENDING_LOGOUT_KEY) === '1'; } catch { return false; } },
  set: (store: KeyValueStore | null = storage()) => { try { store?.setItem(PENDING_LOGOUT_KEY, '1'); } catch { /* best effort */ } },
  clear: (store: KeyValueStore | null = storage()) => { try { store?.removeItem(PENDING_LOGOUT_KEY); } catch { /* best effort */ } },
};

/** Runs fn while holding the cross-tab refresh lock; falls back to running directly on older browsers. */
export function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  return locks ? locks.request(LOCK, fn) : fn();
}

export interface AuthChannel {
  post(message: AuthMessage): void;
  subscribe(listener: (message: AuthMessage) => void): () => void;
}

export function createAuthChannel(): AuthChannel {
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(CHANNEL);
    return {
      post: message => channel.postMessage(message),
      subscribe: listener => {
        const handle = (event: MessageEvent<AuthMessage>) => listener(event.data);
        channel.addEventListener('message', handle);
        return () => channel.removeEventListener('message', handle);
      },
    };
  }
  // Fallback: storage events reach other tabs only. Sessions are never written here, only sign-out signals.
  return {
    post: message => {
      if (message.type !== 'logout') return;
      try { localStorage.setItem(FALLBACK_KEY, `logout:${Date.now()}`); localStorage.removeItem(FALLBACK_KEY); } catch { /* best effort */ }
    },
    subscribe: listener => {
      const handle = (event: StorageEvent) => { if (event.key === FALLBACK_KEY && event.newValue?.startsWith('logout:')) listener({ type: 'logout' }); };
      window.addEventListener('storage', handle);
      return () => window.removeEventListener('storage', handle);
    },
  };
}
