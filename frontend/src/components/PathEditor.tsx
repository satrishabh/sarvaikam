import { FormEvent, useEffect, useState } from 'react';
import { api, Category } from '../api';
import type { LearningPath } from '../learning';
import { authoringSlug } from '../authoring';

const empty: LearningPath = { slug: '', name: '', subtitle: '', description: '', priority: 1, icon: 'layers', tone: 'teal', topics: [], outcomes: [] };
export default function PathEditor({ categories }: { categories: Category[] }) {
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState(empty);
  const [outcomes, setOutcomes] = useState('');
  const [course, setCourse] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const courses = categories.flatMap(c => c.topics);
  const load = () => api.paths().then(setPaths);
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  const move = (index: number, direction: number) => {
    const topics = [...form.topics]; [topics[index], topics[index + direction]] = [topics[index + direction], topics[index]];
    setForm({ ...form, topics });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setStatus('');
    try {
      if (!selected && paths.some(p => p.slug === form.slug)) throw new Error('A path with this URL already exists. Select it above to edit it.');
      const next = { ...form, name: form.name.trim(), outcomes: outcomes.split('\n').map(s => s.trim()).filter(Boolean) };
      await api.savePath(next); setForm(next); setSelected(next.slug);
      setStatus('Learning path saved. The new sequence appears when learners reload the page.'); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <section className="surface space-y-5 p-6"><h2 className="text-2xl font-semibold">Learning path builder</h2><p className="text-muted">Set the priority and arrange courses with the move buttons. Lower priority numbers appear first.</p>
    {error && <p role="alert" className="text-danger">{error}</p>}{status && <p role="status" className="rounded-xl bg-accent-soft p-4">{status}</p>}
    <label className="field">Path to edit<select className="input" disabled={busy} value={selected} onChange={e => { const item = paths.find(p => p.slug === e.target.value); setSelected(e.target.value); setForm(item ?? { ...empty, priority: paths.length + 1 }); setOutcomes(item?.outcomes.join('\n') ?? ''); setCourse(''); setStatus(''); }}><option value="">Create a new path</option>{paths.map(p => <option key={p.slug} value={p.slug}>{p.priority}. {p.name}</option>)}</select></label>
    <form onSubmit={save}><fieldset disabled={busy} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]"><label className="field">Path name<input className="input" required maxLength={200} value={form.name} onChange={e => setForm({ ...form, name: e.target.value, slug: selected ? form.slug : authoringSlug(e.target.value) })} /></label><label className="field">Priority<input className="input" type="number" min={1} max={10000} required value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} /></label></div>
      <label className="field">Short introduction<input className="input" required maxLength={1000} value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} /></label>
      <label className="field">Description<textarea className="input min-h-28" required maxLength={10000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
      <div><h3 className="font-semibold">Course sequence</h3><p className="mt-1 text-sm text-muted">Add courses, then move them into the order learners should follow. Courses without lessons appear after you add their first step.</p>
        <div className="mt-3 flex flex-wrap gap-3"><select aria-label="Course to add" className="input min-w-0 flex-1" value={course} onChange={e => setCourse(e.target.value)}><option value="">Choose a course</option>{courses.filter(c => !form.topics.includes(c.slug)).map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select><button type="button" className="outline-btn" disabled={!course || form.topics.length >= 200} onClick={() => { setForm({ ...form, topics: [...form.topics, course] }); setCourse(''); }}>Add course</button></div>
        <ol className="mt-4 divide-y divide-line">{form.topics.map((slug, index) => <li key={slug} className="flex flex-wrap items-center gap-2 py-3"><span className="min-w-0 flex-1 text-sm">{index + 1}. {courses.find(c => c.slug === slug)?.name ?? slug}</span><button type="button" className="btn-quiet" aria-label={`Move ${slug} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" className="btn-quiet" aria-label={`Move ${slug} down`} disabled={index === form.topics.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" className="btn-quiet text-danger" aria-label={`Remove ${slug} from path`} onClick={() => setForm({ ...form, topics: form.topics.filter(t => t !== slug) })}>Remove</button></li>)}</ol>
      </div>
      <label className="field">Learning outcomes<textarea className="input min-h-28" value={outcomes} onChange={e => setOutcomes(e.target.value)} /><span className="field-help">One outcome per line. Up to 30 outcomes, 1,000 characters each.</span></label>
      <details><summary className="cursor-pointer text-sm text-muted">Appearance and URL</summary><div className="mt-3 grid gap-4 sm:grid-cols-3"><label className="field">Icon<select className="input" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}>{['layers', 'cloud', 'code', 'spark', 'chart', 'target', 'book'].map(i => <option key={i}>{i}</option>)}</select></label><label className="field">Color<select className="input" value={form.tone} onChange={e => setForm({ ...form, tone: e.target.value })}>{['teal', 'violet', 'blue'].map(t => <option key={t}>{t}</option>)}</select></label><label className="field">Path URL<input className="input" required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" disabled={!!selected} value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /></label></div></details>
      <button className="btn" disabled={!form.slug}>{busy ? 'Saving…' : 'Save learning path'}</button>
    </fieldset></form>
  </section>;
}
