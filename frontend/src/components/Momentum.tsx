import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ProgressItem, Topic } from '../api';
import { GOAL_OPTIONS, goalStore, lastDays, lastTouchedTopic, streak, todayCount } from '../engagement';

function GoalRing({ done, goal }: { done: number; goal: number }) {
  const r = 30, c = 2 * Math.PI * r, p = Math.min(done / goal, 1), met = done >= goal;
  return (
    <svg viewBox="0 0 72 72" className="h-[72px] w-[72px] shrink-0 -rotate-90" aria-hidden>
      <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" className="stroke-track" />
      <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)}
              className={`transition-[stroke-dashoffset] duration-700 ${met ? 'stroke-gold' : 'stroke-accent'}`} />
      <text x="36" y="36" dy="0.35em" textAnchor="middle" className="rotate-90 fill-ink text-[17px] font-semibold"
            style={{ transformOrigin: '36px 36px' }}>{met ? '★' : `${done}/${goal}`}</text>
    </svg>
  );
}

/** Signed-in header for Home: today's goal, the streak, the week, and one tap back into the last topic. */
export default function Momentum({ items, name }: { items: ProgressItem[]; name: string }) {
  const [goal, setGoal] = useState(goalStore.get);
  const [resume, setResume] = useState<{ topic: Topic; nextIndex: number } | null>(null);
  const today = todayCount(items);
  const s = streak(items);
  const week = lastDays(items, 7);
  const lastSlug = lastTouchedTopic(items);

  useEffect(() => {
    if (!lastSlug) return setResume(null);
    Promise.all([api.topic(lastSlug), api.topicProgress(lastSlug)])
      .then(([topic, p]) => {
        const done = new Set(p.completedLessonIds);
        setResume({ topic, nextIndex: topic.lessons.findIndex((l) => !done.has(l.id)) });
      })
      .catch(() => setResume(null));
  }, [lastSlug]);

  const chooseGoal = (g: number) => { goalStore.set(g); setGoal(g); };
  const left = Math.max(goal - today, 0);
  const next = resume && resume.nextIndex >= 0 ? resume.topic.lessons[resume.nextIndex] : null;

  return (
    <section aria-label="Your progress today" className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
      <div className="surface flex flex-col gap-5 p-6">
        <div className="flex items-center gap-5">
          <GoalRing done={today} goal={goal} />
          <div className="min-w-0">
            <h2 className="text-[22px] font-semibold leading-snug">
              {today === 0 ? `Ready when you are, ${name.split(' ')[0]}` : left === 0 ? 'Daily goal reached' : `${left} more ${left === 1 ? 'step' : 'steps'} today`}
            </h2>
            <p className="mt-1 text-[16px] text-muted">
              {s.current > 0
                ? <><span aria-hidden className="text-gold">★</span> {s.current}-day streak{s.longest > s.current ? `, best ${s.longest}` : ''}{!s.doneToday && ' · one step today keeps it going'}</>
                : 'One step today starts a streak.'}
            </p>
          </div>
        </div>

        <div className="flex items-end justify-between gap-1.5" aria-label="Steps per day, last 7 days">
          {week.map((d, i) => (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
              <div title={`${d.count} ${d.count === 1 ? 'step' : 'steps'}`}
                   className={`h-9 w-full max-w-[40px] rounded-lg transition-colors ${d.count >= goal ? 'bg-gold' : d.count > 0 ? 'bg-accent' : 'bg-track'}
                     ${i === 6 ? 'ring-2 ring-ink/15 ring-offset-2 ring-offset-surface' : ''}`} />
              <span className={`text-[13px] ${i === 6 ? 'font-semibold text-ink' : 'text-muted'}`}>
                {i === 6 ? 'Today' : d.date.toLocaleDateString(undefined, { weekday: 'narrow' })}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[15px] text-muted">
          Daily goal
          {GOAL_OPTIONS.map((g) => (
            <button key={g} onClick={() => chooseGoal(g)} aria-pressed={goal === g}
                    className={`min-h-[36px] rounded-full px-3.5 font-medium transition-colors ${goal === g ? 'bg-ink text-white' : 'bg-track text-ink hover:bg-line'}`}>
              {g} {g === 1 ? 'step' : 'steps'}
            </button>
          ))}
        </div>
      </div>

      <div className="surface flex flex-col justify-between gap-4 p-6">
        {resume && next ? (
          <>
            <div>
              <p className="text-[15px] text-muted">Continue {resume.topic.name}</p>
              <h3 className="mt-1 text-[22px] font-semibold leading-snug">{next.title}</h3>
              <p className="mt-1 text-[15px] text-muted">Step {next.stepNumber} of {resume.topic.lessons.length}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-track">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((resume.nextIndex / resume.topic.lessons.length) * 100)}%` }} />
              </div>
            </div>
            <Link to={`/topics/${resume.topic.slug}/${next.slug}`} className="btn self-start">Continue</Link>
          </>
        ) : (
          <>
            <div>
              <p className="text-[15px] text-muted">{resume ? `You finished ${resume.topic.name}` : 'Start your first topic'}</p>
              <h3 className="mt-1 text-[22px] font-semibold leading-snug">Pick something new below</h3>
              <p className="mt-1 text-[15px] text-muted">Most steps take under 5 minutes.</p>
            </div>
            <a href="#topics" className="btn self-start">Browse topics</a>
          </>
        )}
      </div>
    </section>
  );
}
