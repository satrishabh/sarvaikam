import { FormEvent, useEffect, useState } from 'react';
import { api, Category, Reel, ReelInput, Topic } from '../api';
import { authoringSlug, readContentFile } from '../authoring';

const empty: ReelInput = { slug: '', courseSlug: '', lessonSlug: '', heading: '', content: '', sourceName: '', sourceUrl: '', published: false };
export default function ReelEditor({ categories }: { categories: Category[] }) {
  const [items, setItems] = useState<Reel[]>([]);
  const [form, setForm] = useState(empty);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const load = () => api.adminReels().then(setItems);
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  useEffect(() => {
    let active = true;
    setTopic(null);
    if (form.courseSlug) api.topic(form.courseSlug).then(t => { if (active) setTopic(t); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [form.courseSlug]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { if (!editing && items.some(r => r.slug === form.slug)) throw new Error('This reel URL already exists. Select it above to edit it.'); await api.saveReel(form); setEditing(true); await load(); setMessage(form.published ? 'Reel published.' : 'Draft saved.'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirm('Delete this reel?')) return;
    setBusy(true); setError(''); setMessage('');
    try { await api.deleteReel(form.slug); await load(); setForm(empty); setEditing(false); setMessage('Reel deleted.'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <section className="surface space-y-5 p-6">
    <h2 className="text-2xl font-semibold">Reel studio</h2>
    <p className="text-muted">Course, step, heading, content, then the original source. Save a draft or publish to the feed.</p>
    {error && <p role="alert" className="text-danger">{error}</p>}
    {message && <p role="status">{message}</p>}
    <label className="field">Edit a reel<select className="input" value={editing ? form.slug : ''} disabled={busy} onChange={e => { const item = items.find(r => r.slug === e.target.value); setForm(item ?? empty); setEditing(!!item); setMessage(''); }}>
      <option value="">New reel</option>{items.map(r => <option key={r.slug} value={r.slug}>{r.heading} · {r.published ? 'Published' : 'Draft'}</option>)}
    </select></label>
    <form onSubmit={save}><fieldset disabled={busy} className="space-y-4">
      <details><summary className="cursor-pointer text-sm text-muted">Reel URL (generated from heading)</summary><label className="field mt-3">URL name<input className="input" required disabled={editing} maxLength={150} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /></label></details>
      <label className="field">Course<select aria-label="Course" className="input" required value={form.courseSlug} onChange={e => setForm({ ...form, courseSlug: e.target.value, lessonSlug: '' })}><option value="">Choose course</option>{categories.flatMap(c => c.topics).map(t => <option key={t.slug} value={t.slug}>{t.name}</option>)}</select></label>
      <label className="field">Step<select aria-label="Step" className="input" required value={form.lessonSlug} onChange={e => setForm({ ...form, lessonSlug: e.target.value })}><option value="">Choose lesson step</option>{topic?.lessons.map(l => <option key={l.slug} value={l.slug}>{l.stepNumber}. {l.title}</option>)}</select></label>
      <label className="field">Heading<input className="input" required maxLength={250} value={form.heading} onChange={e => setForm({ ...form, heading: e.target.value, slug: editing ? form.slug : authoringSlug(e.target.value, 150) })} /></label>
      <label className="field">Or upload reel text<input type="file" accept=".txt,.md,.markdown" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file && (!form.content || confirm('Replace the reel content with this file?'))) { setBusy(true); setError(''); void readContentFile(file, 2000).then(content => setForm(f => ({ ...f, content }))).catch(e => setError(e.message)).finally(() => setBusy(false)); } }} /><span className="field-help">Text or Markdown, up to 2,000 characters.</span></label>
      <label className="field">Content<textarea className="input min-h-40" required maxLength={2000} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /><span className="field-help">One short point per line.</span></label>
      <label className="field">Source name<input className="input" required maxLength={250} value={form.sourceName} onChange={e => setForm({ ...form, sourceName: e.target.value })} /></label>
      <label className="field">Source URL<input className="input" type="url" pattern="https://.*" required maxLength={2000} placeholder="https://" value={form.sourceUrl} onChange={e => setForm({ ...form, sourceUrl: e.target.value })} /></label>
      <label className="flex gap-3"><input type="checkbox" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} />Publish to reels</label>
      <div className="flex gap-3"><button className="btn" disabled={!form.slug}>{busy ? 'Saving…' : 'Save reel'}</button>{editing && <button type="button" className="btn-quiet text-danger" onClick={() => void remove()}>Delete reel</button>}</div>
    </fieldset></form>
  </section>;
}
