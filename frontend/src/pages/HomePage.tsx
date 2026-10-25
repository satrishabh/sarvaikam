import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Category, TopicSummary } from '../api';

const levelColor: Record<string, string> = {
  BEGINNER: 'text-emerald-400',
  INTERMEDIATE: 'text-amber-400',
  ADVANCED: 'text-rose-400',
};

function TopicCard({ t }: { t: TopicSummary }) {
  return (
    <Link to={`/topics/${t.slug}`} className="card block">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t.name}</h3>
        <span className={`text-xs ${levelColor[t.level] ?? ''}`}>{t.level}</span>
      </div>
      <p className="mt-2 text-sm text-slate-400">{t.summary}</p>
      <p className="mt-3 text-xs text-slate-500">{t.lessonCount} steps</p>
    </Link>
  );
}

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TopicSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.categories().then(setCategories).catch((e) => setError(e.message));
  }, []);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return setResults(null);
    setResults(await api.search(query.trim()).catch(() => []));
  };

  return (
    <div className="space-y-10">
      <section className="text-center">
        <h1 className="text-4xl font-bold">Learn trending technology, one step at a time</h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-400">
          Roadmaps for Terraform, Kubernetes, clouds, languages, AI/LLMs, backend frameworks and data platforms.
        </p>
        <form onSubmit={search} className="mx-auto mt-6 flex max-w-xl gap-2">
          <input className="input" placeholder="Search topics (e.g. kubernetes, llm, snowflake)"
                 value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="btn">Search</button>
        </form>
      </section>

      {error && <p className="text-rose-400">Could not load content: {error}</p>}

      {results && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Results for "{query}"</h2>
          {results.length === 0 ? <p className="text-slate-400">No topics found.</p> : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((t) => <TopicCard key={t.id} t={t} />)}
            </div>
          )}
        </section>
      )}

      {categories.map((c) => (
        <section key={c.id} id={c.slug}>
          <h2 className="text-2xl font-semibold">{c.icon} {c.name}</h2>
          <p className="mb-4 text-slate-400">{c.description}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.topics.map((t) => <TopicCard key={t.id} t={t} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
