import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Category, ProgressItem } from '../api';
import { useAuth } from '../auth';

export interface TopicSkill { slug: string; name: string; level: string; done: number; total: number }
export interface CategorySkill { slug: string; name: string; icon: string; done: number; total: number; topics: TopicSkill[] }

/** Joins the catalogue with the signed-in user's completed steps. Anonymous users get done = 0 everywhere. */
export function useSkills(categories: Category[]) {
  const { user } = useAuth();
  const [items, setItems] = useState<ProgressItem[]>([]);

  useEffect(() => {
    if (!user) return setItems([]);
    api.myProgress().then(setItems).catch(() => setItems([]));
  }, [user]);

  const skills = useMemo<CategorySkill[]>(() => {
    const perTopic = new Map<string, number>();
    for (const p of items) perTopic.set(p.topicSlug, (perTopic.get(p.topicSlug) ?? 0) + 1);
    return categories.map((c) => {
      // Clamp in case lessons were deleted after being completed.
      const topics = c.topics.map((t) => ({
        slug: t.slug, name: t.name, level: t.level, total: t.lessonCount,
        done: Math.min(perTopic.get(t.slug) ?? 0, t.lessonCount),
      }));
      return {
        slug: c.slug, name: c.name, icon: c.icon, topics,
        done: topics.reduce((s, t) => s + t.done, 0),
        total: topics.reduce((s, t) => s + t.total, 0),
      };
    });
  }, [categories, items]);

  const lastActivity = items.reduce<string | null>((latest, p) => (!latest || p.completedAt > latest ? p.completedAt : latest), null);
  return { skills, signedIn: !!user, lastActivity };
}

const pct = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

/** One segment per topic; width is proportional to the topic's step count so the bar reads as "steps", not "topics". */
function SegmentedTrack({ topics }: { topics: TopicSkill[] }) {
  return (
    <div className="flex h-3 w-full gap-[3px]" role="presentation">
      {topics.map((t) => {
        const complete = t.total > 0 && t.done === t.total;
        return (
          <div key={t.slug} title={`${t.name}: ${t.done} of ${t.total} steps`}
               className="h-full overflow-hidden rounded-full bg-track" style={{ flexGrow: Math.max(t.total, 1), flexBasis: 0 }}>
            <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${complete ? 'bg-gold' : 'bg-accent'}`}
                 style={{ width: `${pct(t.done, t.total)}%` }} />
          </div>
        );
      })}
    </div>
  );
}

function CategoryRow({ c, signedIn, open, onToggle }: { c: CategorySkill; signedIn: boolean; open: boolean; onToggle: () => void }) {
  const p = pct(c.done, c.total);
  return (
    <li className="py-5">
      <button onClick={onToggle} aria-expanded={open}
              aria-label={`${c.name}: ${c.done} of ${c.total} steps complete. ${open ? 'Hide' : 'Show'} topics`}
              className="group w-full text-left">
        <div className="mb-3 flex items-baseline gap-3">
          <span aria-hidden className="text-xl">{c.icon}</span>
          <span className="text-[19px] font-semibold tracking-tight">{c.name}</span>
          <span className="ml-auto tabular-nums text-[15px] text-muted">
            {signedIn ? <><span className="font-semibold text-ink">{c.done}</span> of {c.total} steps</> : `${c.total} steps`}
          </span>
          {signedIn && <span className="w-12 text-right tabular-nums text-[15px] font-semibold">{p}%</span>}
        </div>
        <SegmentedTrack topics={c.topics} />
      </button>
      {open && (
        <ul className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {c.topics.map((t) => (
            <li key={t.slug}>
              <Link to={`/topics/${t.slug}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-track">
                <span className="flex-1 truncate text-[15px]">{t.name}</span>
                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-track">
                  <span className={`block h-full rounded-full ${t.done === t.total && t.total ? 'bg-gold' : 'bg-accent'}`}
                        style={{ width: `${pct(t.done, t.total)}%` }} />
                </span>
                <span className="w-12 text-right tabular-nums text-[13px] text-muted">{t.done}/{t.total}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function SkillMap({ skills, signedIn, limit }: { skills: CategorySkill[]; signedIn: boolean; limit?: number }) {
  const [open, setOpen] = useState<string | null>(null);
  // In the compact view, show the categories the learner is furthest along in.
  const shown = limit
    ? [...skills].sort((a, b) => pct(b.done, b.total) - pct(a.done, a.total)).slice(0, limit)
    : skills;
  return (
    <ul className="divide-y divide-line">
      {shown.map((c) => (
        <CategoryRow key={c.slug} c={c} signedIn={signedIn} open={open === c.slug}
                     onToggle={() => setOpen(open === c.slug ? null : c.slug)} />
      ))}
    </ul>
  );
}
