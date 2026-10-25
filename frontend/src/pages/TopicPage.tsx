import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, Topic } from '../api';
import { useAuth } from '../auth';

export default function TopicPage() {
  const { topicSlug = '' } = useParams();
  const { user } = useAuth();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    api.topic(topicSlug).then(setTopic).catch((e) => setError(e.message));
  }, [topicSlug]);

  useEffect(() => {
    if (!user) return setDone(new Set());
    api.topicProgress(topicSlug).then((p) => setDone(new Set(p.completedLessonIds))).catch(() => {});
  }, [topicSlug, user]);

  if (error) return <p className="text-rose-400">{error}</p>;
  if (!topic) return <p>Loading...</p>;

  const pct = topic.lessons.length ? Math.round((done.size / topic.lessons.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={`/#${topic.categorySlug}`} className="text-sm text-indigo-400">&larr; {topic.categoryName}</Link>
      <h1 className="mt-2 text-3xl font-bold">{topic.name} Roadmap</h1>
      <p className="mt-2 text-slate-400">{topic.summary}</p>

      {user && (
        <div className="mt-6">
          <div className="mb-1 text-sm text-slate-400">Progress: {pct}%</div>
          <div className="h-2 rounded bg-slate-800">
            <div className="h-2 rounded bg-indigo-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <ol className="relative mt-8 border-l border-slate-700">
        {topic.lessons.map((l) => (
          <li key={l.id} className="mb-6 ml-6">
            <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full text-xs
              ${done.has(l.id) ? 'bg-emerald-600' : 'bg-slate-700'}`}>
              {done.has(l.id) ? '✓' : l.stepNumber}
            </span>
            <Link to={`/topics/${topic.slug}/${l.slug}`} className="card block">
              <span className="text-xs text-slate-500">Step {l.stepNumber}</span>
              <h3 className="font-semibold">{l.title}</h3>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
