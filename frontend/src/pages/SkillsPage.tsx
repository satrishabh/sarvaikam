import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Category } from '../api';
import SkillMap, { useSkills } from '../components/SkillMap';

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <div className="font-display text-[40px] font-semibold leading-none tracking-tight tabular-nums">{value}</div>
      <div className="mt-2 text-[15px] text-muted">{label}</div>
    </div>
  );
}

export default function SkillsPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState('');
  const { skills, signedIn, lastActivity } = useSkills(categories ?? []);

  useEffect(() => {
    api.categories().then(setCategories).catch((e) => setError(e.message));
  }, []);

  const done = skills.reduce((s, c) => s + c.done, 0);
  const total = skills.reduce((s, c) => s + c.total, 0);
  const topicsFinished = skills.reduce((s, c) => s + c.topics.filter((t) => t.total > 0 && t.done === t.total).length, 0);
  const topicsTotal = skills.reduce((s, c) => s + c.topics.length, 0);

  return (
    <div className="space-y-12">
      <header className="max-w-2xl">
        <h1 className="text-[44px] font-semibold leading-tight tracking-tightest">Skill map</h1>
        <p className="mt-3 text-[19px] text-muted">
          Every subject on Sarvaikam, sized by how many steps it has. Teal is progress; gold is a finished topic. Select a subject to see its topics.
        </p>
      </header>

      {error && <p className="text-danger">The skill map couldn't load: {error}</p>}

      {signedIn ? (
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <Stat value={`${total ? Math.round((done / total) * 100) : 0}%`} label="of all steps done" />
          <Stat value={done} label={`of ${total} steps complete`} />
          <Stat value={topicsFinished} label={`of ${topicsTotal} topics finished`} />
          <Stat value={lastActivity ? new Date(lastActivity).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'None'}
                label="last step completed" />
        </div>
      ) : (
        <div className="surface flex flex-wrap items-center gap-4 p-5">
          <p className="flex-1 text-[15px] text-muted">You're seeing the catalogue. Sign in and every step you complete shows up here.</p>
          <Link to="/login" className="btn">Sign in to track progress</Link>
        </div>
      )}

      <section className="surface p-6 sm:p-10">
        {categories
          ? <SkillMap skills={skills} signedIn={signedIn} />
          : !error && <div className="space-y-6">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-10" />)}</div>}
      </section>
    </div>
  );
}
