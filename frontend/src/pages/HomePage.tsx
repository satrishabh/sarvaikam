import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Category, TopicSummary } from '../api';
import SkillMap, { useSkills } from '../components/SkillMap';

const levelLabel: Record<string, string> = { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced' };

function TopicRow({ t }: { t: TopicSummary }) {
  return (
    <li>
      <Link to={`/topics/${t.slug}`} className="group flex items-baseline gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-surface">
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-medium group-hover:text-accent">{t.name}</span>
          <span className="mt-0.5 block truncate text-[15px] text-muted">{t.summary}</span>
        </span>
        <span className="hidden shrink-0 text-[14px] text-muted sm:block">{levelLabel[t.level] ?? t.level}</span>
        <span className="w-16 shrink-0 text-right tabular-nums text-[14px] text-muted">{t.lessonCount} steps</span>
      </Link>
    </li>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading topics">
      {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-14" />)}
    </div>
  );
}

export default function HomePage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TopicSummary[] | null>(null);
  const [error, setError] = useState('');
  const { skills, signedIn } = useSkills(categories ?? []);

  useEffect(() => {
    api.categories().then(setCategories).catch((e) => setError(e.message));
  }, []);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return setResults(null);
    setResults(await api.search(query.trim()).catch(() => []));
  };

  const totalSteps = (categories ?? []).reduce((s, c) => s + c.topics.reduce((n, t) => n + t.lessonCount, 0), 0);

  return (
    <div className="space-y-20">
      <section className="mx-auto max-w-3xl pt-4 text-center">
        <h1 className="text-[44px] font-semibold leading-[1.05] tracking-tightest sm:text-[60px]">
          Learn the tools teams ship with, one step at a time.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[19px] text-muted">
          Short, ordered steps for Kubernetes, Terraform, cloud, languages, AI and data. Mark each one done and watch your skill map fill in.
        </p>
        <form onSubmit={search} role="search" className="mx-auto mt-9 flex max-w-xl gap-2">
          <input className="input h-12 rounded-full px-5" aria-label="Search topics" placeholder="Search Kubernetes, LLMs, Snowflake"
                 value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="btn h-12">Search</button>
        </form>
      </section>

      {error && (
        <div className="surface mx-auto max-w-xl p-5 text-center">
          <p className="font-medium">Topics couldn't be loaded.</p>
          <p className="mt-1 text-[15px] text-muted">The content service didn't respond ({error}). Refresh in a minute; it may still be starting.</p>
        </div>
      )}

      {results && (
        <section aria-live="polite">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-2xl font-semibold">Results for "{query}"</h2>
            <button className="link text-[15px]" onClick={() => { setResults(null); setQuery(''); }}>Clear search</button>
          </div>
          {results.length === 0
            ? <p className="text-muted">No topics match. Try a broader word such as "cloud" or "python".</p>
            : <ul className="-mx-3">{results.map((t) => <TopicRow key={t.id} t={t} />)}</ul>}
        </section>
      )}

      {categories && categories.length > 0 && (
        <section className="surface p-6 sm:p-10">
          <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="text-[28px] font-semibold">{signedIn ? 'Your skill map' : 'What you can learn'}</h2>
            <Link to="/skills" className="link ml-auto text-[15px]">See the full map</Link>
          </div>
          <p className="text-[15px] text-muted">
            {signedIn
              ? 'Each bar is a subject; each segment is a topic. Gold means finished.'
              : <>{totalSteps} steps across {categories.length} subjects. <Link to="/login" className="link">Sign in</Link> to track your progress.</>}
          </p>
          <div className="mt-4"><SkillMap skills={skills} signedIn={signedIn} limit={signedIn ? 3 : undefined} /></div>
        </section>
      )}

      {!categories && !error && <LoadingRows />}

      {categories?.map((c) => (
        <section key={c.id} id={c.slug} className="scroll-mt-24">
          <h2 className="flex items-center gap-3 text-[28px] font-semibold">
            <span aria-hidden>{c.icon}</span>{c.name}
          </h2>
          <p className="mt-1 max-w-read text-muted">{c.description}</p>
          <ul className="-mx-3 mt-4 divide-y divide-line/70">
            {c.topics.map((t) => <TopicRow key={t.id} t={t} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
