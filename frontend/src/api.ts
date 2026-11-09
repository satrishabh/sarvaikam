import type { ReaderPreferences } from './readerPreferences';

export interface TopicSummary {
  id: number;
  slug: string;
  name: string;
  summary: string;
  level: string;
  categorySlug: string;
  lessonCount: number;
}
export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  topics: TopicSummary[];
}
export type LearningStage = "STARTER" | "INTERMEDIATE" | "ADVANCED" | "DEEP_DIVE";
export interface LessonSummary {
  id: number;
  slug: string;
  title: string;
  stepNumber: number;
  exclusive: boolean;
  stage?: LearningStage;
}
export interface Topic {
  id: number;
  slug: string;
  name: string;
  summary: string;
  level: string;
  categorySlug: string;
  categoryName: string;
  lessons: LessonSummary[];
}
export interface Lesson extends LessonSummary {
  contentMd: string;
  topicSlug: string;
  topicName: string;
  totalSteps: number;
  previous: LessonSummary | null;
  next: LessonSummary | null;
}
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  permissions: Permission[];
  businessStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  organization: string;
  businessWebsite: string;
  businessReason: string;
  reviewNote: string;
  reviewedAt: string | null;
  disabled: boolean;
  createdAt: string;
  readerPreferences: ReaderPreferences | null;
}
export type Role = 'ADMIN' | 'BUSINESS' | 'USER';
export type Permission = 'content.exclusive' | 'content.manage' | 'assets.download' | 'candidates.view';
export interface RolePolicy { role: Role; permissions: Permission[] }
export interface AuditEntry { id: string; actor: string; action: string; target: string; details: Record<string, unknown>; createdAt: string }
export interface Asset { id: string; filename: string; contentType: string; size: number }
export interface Session { token: string; user: User }
export interface BookmarkItem { lessonId: number; topicSlug: string; createdAt: string }
export const can = (user: User | null, permission: Permission) => user?.permissions.includes(permission) ?? false;
export interface ProgressItem {
  lessonId: number;
  topicSlug: string;
  completedAt: string;
}

const TOKEN_KEY = 'sarvaikam.token';
let currentToken: string | null = null;
export const tokenStore = {
  get: () => currentToken,
  set: (t: string | null) => {
    currentToken = t;
    localStorage.removeItem(TOKEN_KEY);
  },
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-Sarvaikam-Client', 'web');
  if (init.body) headers.set('Content-Type', 'application/json');
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message ?? body.error;
    throw new Error(msg ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const enc = encodeURIComponent;
const fileType = (file: File) => ({ pdf: 'application/pdf', zip: 'application/zip', mp4: 'video/mp4', webm: 'video/webm', txt: 'text/plain' }[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream');

export const api = {
  categories: () => request<Category[]>('/api/content/categories'),
  topic: (slug: string) => request<Topic>(`/api/content/topics/${enc(slug)}`),
  lesson: (topic: string, lesson: string) =>
    request<Lesson>(`/api/content/topics/${enc(topic)}/lessons/${enc(lesson)}`),
  search: (q: string) => request<TopicSummary[]>(`/api/content/search?q=${enc(q)}`),

  exchangeProfileToken: async (accessToken: string) => {
    const res = await fetch('/api/auth/oidc/exchange', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? body.error ?? `Sign-in failed (${res.status})`);
    }
    return res.json() as Promise<{ token: string; user: User }>;
  },
  me: () => request<User>('/api/auth/me'),
  login: (email: string, password: string) => request<Session>('/api/auth/session/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) => request<{ message: string }>('/api/auth/session/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  refresh: () => request<Session>('/api/auth/session/refresh', { method: 'POST' }),
  logout: () => request<void>('/api/auth/session/logout', { method: 'POST' }),
  emailAction: (action: 'recover' | 'verify-email', email: string) => request<{ message: string }>(`/api/auth/session/${action}`, { method: 'POST', body: JSON.stringify({ email }) }),
  applyBusiness: (body: { organization: string; website: string; reason: string }) => request<User>('/api/auth/me/business-application', { method: 'POST', body: JSON.stringify(body) }),
  users: (q: string, status: string, page: number) => request<{ items: User[]; total: number; page: number; pageSize: number }>(`/api/auth/admin/users?q=${enc(q)}&status=${enc(status)}&page=${page}`),
  reviewBusiness: (id: string, decision: 'APPROVED' | 'REJECTED', note: string) => request<User>(`/api/auth/admin/users/${enc(id)}/business-review`, { method: 'POST', body: JSON.stringify({ decision, note }) }),
  updateAccess: (id: string, body: { role?: Role; disabled?: boolean }) => request<User>(`/api/auth/admin/users/${enc(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  policies: () => request<RolePolicy[]>('/api/auth/admin/roles'),
  savePolicy: (role: Role, permissions: Permission[]) => request<RolePolicy>(`/api/auth/admin/roles/${role}`, { method: 'PUT', body: JSON.stringify({ permissions }) }),
  audit: () => request<AuditEntry[]>('/api/auth/admin/audit'),
  assets: (lessonId: number) => request<Asset[]>(`/api/content/lessons/${lessonId}/assets`),
  startUpload: (lessonId: number, file: File) => request<{ id: string; url: string; headers: Record<string, string> }>(`/api/content/admin/lessons/${lessonId}/assets/upload`, { method: 'POST', body: JSON.stringify({ filename: file.name, contentType: fileType(file), size: file.size }) }),
  finishUpload: (id: string) => request<Asset>(`/api/content/admin/assets/${enc(id)}/complete`, { method: 'POST' }),
  download: (id: string) => request<{ url: string }> (`/api/content/assets/${enc(id)}/download`),
  deleteAsset: (id: string) => request<void>(`/api/content/admin/assets/${enc(id)}`, { method: 'DELETE' }),

  myProgress: () => request<ProgressItem[]>('/api/progress/me'),
  userProgress: (id: string) => request<ProgressItem[]>(`/api/progress/users/${enc(id)}`),
  topicProgress: (slug: string) =>
    request<{ completedLessonIds: number[] }>(`/api/progress/me/topics/${enc(slug)}`),
  complete: (lessonId: number, topicSlug: string) =>
    request<void>(`/api/progress/lessons/${lessonId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ topicSlug }),
    }),
  uncomplete: (lessonId: number) =>
    request<void>(`/api/progress/lessons/${lessonId}/complete`, { method: 'DELETE' }),
  updateReaderPreferences: (prefs: ReaderPreferences) =>
    request<User>('/api/auth/me/reader-preferences', { method: 'PUT', body: JSON.stringify(prefs) }),
  bookmarks: () => request<BookmarkItem[]>('/api/progress/me/bookmarks'),
  bookmark: (lessonId: number, topicSlug: string) =>
    request<void>(`/api/progress/lessons/${lessonId}/bookmark`, {
      method: 'PUT',
      body: JSON.stringify({ topicSlug }),
    }),
  unbookmark: (lessonId: number) =>
    request<void>(`/api/progress/lessons/${lessonId}/bookmark`, { method: 'DELETE' }),

  upsertLesson: (l: { topicSlug: string; slug: string; title: string; stepNumber: number; contentMd: string; exclusive: boolean; stage?: LearningStage }) =>
    request<LessonSummary>('/api/content/admin/lessons', { method: 'PUT', body: JSON.stringify(l) }),
  deleteLesson: (id: number) => request<void>(`/api/content/admin/lessons/${id}`, { method: 'DELETE' }),
};
