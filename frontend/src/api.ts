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
export interface LessonSummary {
  id: number;
  slug: string;
  title: string;
  stepNumber: number;
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
  role: 'USER' | 'ADMIN';
}
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

  myProgress: () => request<ProgressItem[]>('/api/progress/me'),
  topicProgress: (slug: string) =>
    request<{ completedLessonIds: number[] }>(`/api/progress/me/topics/${enc(slug)}`),
  complete: (lessonId: number, topicSlug: string) =>
    request<void>(`/api/progress/lessons/${lessonId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ topicSlug }),
    }),
  uncomplete: (lessonId: number) =>
    request<void>(`/api/progress/lessons/${lessonId}/complete`, { method: 'DELETE' }),

  upsertLesson: (l: { topicSlug: string; slug: string; title: string; stepNumber: number; contentMd: string }) =>
    request<LessonSummary>('/api/content/admin/lessons', { method: 'PUT', body: JSON.stringify(l) }),
  deleteLesson: (id: number) => request<void>(`/api/content/admin/lessons/${id}`, { method: 'DELETE' }),
};
