import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, Topic } from '../api';
import { useAuth } from '../auth';

const levelLabel: Record<string, string> = { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced' };

function Ring({ value }: { value: number }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" role="img" aria-label={`${value}% complete`}>
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-track" />
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
              className={`transition-[stroke-dashoffset] duration-500 ${value === 100 ? 'stroke-gold' : 'stroke-accent'}`}
              strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      <text x="32" y="32" dy="0.35em" textAnchor="middle" className="rotate-90 fill-ink text-[15px] font-semibold"
            style={{ transformOrigin: '32px 32px' }}>{value}%</text>
    </svg>
  );
}

export default function TopicPage() {
  const { topicSlug = '' } = useParams();
  const { user } = useAuth();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    setTopic(null);
    api.topic(topicSlug).then(setTopic).catch((e) => setError(e.message));
  }, [topicSlug]);

  useEffect(() => {
    if (!user) return setDone(new Set());
    api.topicProgress(topicSlug).then((p) => setDone(new Set(p.completedLessonIds))).catch(() => {});
  }, [topicSlug, user]);

  if (error) return (
    <div className="py-20 text-center">
      <h1 className="text-3xl font-semibold">This topic couldn't be loaded</h1>
      <p className="mt-2 text-muted">{error}</p>
      <Link to="/" className="link mt-4 inline-block">Back to Explore</Link>
    </div>
  );
  if (!topic) return <div className="mx-auto max-w-3xl space-y-4"><div className="skeleton h-12 w-2/3" />{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-16" />)}</div>;

  const pct = topic.lessons.length ? Math.round((done.size / topic.lessons.length) * 100) : 0;
  const nextUp = topic.lessons.find((l) => !done.has(l.id));

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={`/#${topic.categorySlug}`} className="link text-[15px]">{topic.categoryName}</Link>
      <div className="mt-3 flex items-start gap-6">
        <div className="flex-1">
          <h1 className="text-[44px] font-semibold leading-tight tracking-tightest">{topic.name}</h1>
          <p className="mt-3 max-w-read text-[19px] text-muted">{topic.summary}</p>
          <p className="mt-3 text-[15px] text-muted">{levelLabel[topic.level] ?? topic.level}, {topic.lessons.length} steps</p>
        </div>
        {user && <Ring value={pct} />}
      </div>

      {topic.lessons.length > 0 && (
        <div className="mt-8">
          {nextUp
            ? <Link to={`/topics/${topic.slug}/${nextUp.slug}`} className="btn">
                {done.size === 0 ? 'Start with step 1' : `Continue at step ${nextUp.stepNumber}`}
              </Link>
            : <p className="inline-flex items-center gap-2 rounded-full bg-gold-soft px-4 py-2 text-[15px] font-medium">
                <span aria-hidden className="text-gold">★</span> You've finished every step in this topic.
              </p>}
          {!user && <p className="mt-3 text-[15px] text-muted"><Link to="/login" className="link">Sign in</Link> to save your progress.</p>}
        </div>
      )}

      {/* Lessons are a real sequence, so the numbered stepper carries meaning. */}
      <ol className="mt-12">
        {topic.lessons.map((l, i) => {
          const isDone = done.has(l.id);
          const isNext = nextUp?.id === l.id;
          return (
            <li key={l.id} className="relative flex gap-5 pb-2">
              {i < topic.lessons.length - 1 && <span aria-hidden className={`absolute left-[15px] top-9 h-[calc(100%-28px)] w-0.5 ${isDone ? 'bg-gold/60' : 'bg-line'}`} />}
              <span aria-hidden className={`relative z-10 mt-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold tabular-nums
                ${isDone ? 'bg-gold text-white' : isNext ? 'bg-accent text-white' : 'border-2 border-line bg-surface text-muted'}`}>
                {isDone ? '✓' : l.stepNumber}
              </span>
              <Link to={`/topics/${topic.slug}/${l.slug}`}
                    className={`flex-1 rounded-xl px-4 py-3.5 transition-colors hover:bg-surface ${isNext ? 'bg-surface ring-1 ring-line' : ''}`}>
                <span className="sr-only">Step {l.stepNumber}{isDone ? ', complete' : ''}: </span>
                <span className={`text-[17px] font-medium ${isDone ? 'text-muted' : ''}`}>{l.title}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
