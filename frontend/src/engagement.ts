import { ProgressItem } from "./api";

/** Local calendar day as YYYY-MM-DD, so streaks follow the learner's own midnight. */
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export function dailyCounts(items: ProgressItem[]) {
  const counts = new Map<string, number>();
  for (const p of items) {
    const k = dayKey(new Date(p.completedAt));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

/**
 * Consecutive days with at least one step. A streak stays alive until today ends:
 * if nothing is done yet today, it counts back from yesterday.
 */
export function streak(items: ProgressItem[], now = new Date()) {
  const counts = dailyCounts(items);
  let cursor = counts.has(dayKey(now)) ? now : addDays(now, -1);
  let current = 0;
  while (counts.has(dayKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const days = [...counts.keys()].sort();
  let longest = 0,
    run = 0,
    prev: string | null = null;
  for (const k of days) {
    const [y, m, d] = k.split("-").map(Number);
    run =
      prev && dayKey(addDays(new Date(y, m - 1, d), -1)) === prev ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = k;
  }
  return {
    current,
    longest: Math.max(longest, current),
    doneToday: counts.has(dayKey(now)),
  };
}

/** Steps per day for the last `n` days, oldest first. */
export function lastDays(items: ProgressItem[], n = 7, now = new Date()) {
  const counts = dailyCounts(items);
  return Array.from({ length: n }, (_, i) => {
    const d = addDays(now, i - (n - 1));
    return { key: dayKey(d), date: d, count: counts.get(dayKey(d)) ?? 0 };
  });
}

export const todayCount = (items: ProgressItem[], now = new Date()) =>
  dailyCounts(items).get(dayKey(now)) ?? 0;

export const lastTouchedTopic = (items: ProgressItem[]) =>
  items.reduce<ProgressItem | null>(
    (a, p) => (!a || p.completedAt > a.completedAt ? p : a),
    null,
  )?.topicSlug ?? null;

export const weekCountByTopic = (items: ProgressItem[], now = new Date()) => {
  const since = dayKey(addDays(now, -6));
  const m = new Map<string, number>();
  for (const p of items)
    if (dayKey(new Date(p.completedAt)) >= since)
      m.set(p.topicSlug, (m.get(p.topicSlug) ?? 0) + 1);
  return m;
};

/** About 200 words a minute; code blocks count as reading too. Never less than a minute. */
export const readingMinutes = (md: string) =>
  Math.max(1, Math.round(md.split(/\s+/).filter(Boolean).length / 200));

const GOAL_KEY = "sarvaikam.dailyGoal";
export const GOAL_OPTIONS = [1, 3, 5] as const;
export const goalStore = {
  get: () => {
    try {
      const v = Number(localStorage.getItem(GOAL_KEY));
      return GOAL_OPTIONS.includes(v as 1) ? v : 3;
    } catch {
      return 3;
    }
  },
  set: (v: number) => {
    try {
      localStorage.setItem(GOAL_KEY, String(v));
    } catch {
      /* The goal still works for this visit when storage is unavailable. */
    }
  },
};
