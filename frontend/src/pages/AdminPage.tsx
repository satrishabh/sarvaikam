import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, can, Category, Topic } from '../api';
import { useAuth } from '../auth';
import LessonAssets from '../components/LessonAssets';

const empty = { slug: '', title: '', stepNumber: 1, contentMd: '', exclusive: false };
export default function AdminPage() {
  const { user, ready } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [topicSlug, setTopicSlug] = useState('');
  const [topic, setTopic] = useState<Topic | null>(null);
  const [form, setForm] = useState(empty);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  useEffect(() => { api.categories().then(setCategories).catch(cause => setError(cause.message)); }, []);
  const loadTopic = async (slug: string) => {
    setTopicSlug(slug); setForm(empty); setLessonId(null); setTopic(null); setError('');
    try { if (slug) setTopic(await api.topic(slug)); } catch (cause) { setError((cause as Error).message); }
  };
  if (!ready) return <p role="status">Loading access…</p>;
  if (!can(user, 'content.manage')) return <p className="py-20 text-center text-muted">Your account needs permission to manage content. <Link className="link" to="/profile">View your access</Link></p>;
  const edit = async (slug: string) => {
    setBusy(true); setError(''); setStatus('');
    try { const lesson = await api.lesson(topicSlug, slug); setForm({ slug: lesson.slug, title: lesson.title, stepNumber: lesson.stepNumber, contentMd: lesson.contentMd, exclusive: lesson.exclusive }); setLessonId(lesson.id); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setStatus('');
    try { const lesson = await api.upsertLesson({ topicSlug, ...form, title: form.title.trim() }); setLessonId(lesson.id); setTopic(await api.topic(topicSlug)); setStatus('Lesson saved. You can attach learning resources below.'); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async (id: number) => {
    if (!confirm('Delete this lesson and its resource links? This cannot be undone.')) return;
    setBusy(true); setError('');
    try { await api.deleteLesson(id); await loadTopic(topicSlug); setStatus('Lesson deleted.'); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  return <div className="space-y-7"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">WORKSPACE / CONTENT</p><h1 className="mt-3 text-4xl font-semibold tracking-tightest">Content studio</h1><p className="mt-2 text-muted">Thoughtful lessons. Useful resources. The right access.</p></div>{can(user, 'candidates.view') && <Link className="btn-quiet border border-line" to="/admin/users">Profile management</Link>}</header>
    {error && <p role="alert" className="rounded-xl bg-danger/5 p-4 text-base text-danger">{error}</p>}{status && <p role="status" className="rounded-xl bg-accent-soft p-4 text-base">{status}</p>}
    <div className="grid items-start gap-7 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-4"><label className="field">Choose a topic<select className="input" value={topicSlug} disabled={busy} onChange={event => void loadTopic(event.target.value)}><option value="">Select a topic</option>{categories.map(category => <optgroup key={category.id} label={category.name}>{category.topics.map(t => <option key={t.id} value={t.slug}>{t.name}</option>)}</optgroup>)}</select></label>
        <ol className="space-y-2">{topic?.lessons.map(lesson => <li key={lesson.id} className={`surface p-2 ${lessonId === lesson.id ? 'border-accent' : ''}`}><button type="button" className="min-h-11 w-full rounded-lg px-2 py-2 text-left text-base font-medium hover:bg-track" disabled={busy} onClick={() => void edit(lesson.slug)}>{lesson.stepNumber}. {lesson.title}</button><div className="flex items-center justify-between px-2"><span className="text-xs text-muted">{lesson.exclusive ? 'Exclusive' : 'Standard'}</span><button className="btn-quiet text-danger" disabled={busy} onClick={() => void remove(lesson.id)}>Delete</button></div></li>)}</ol>
        {topic && <button className="btn-quiet w-full border border-line" disabled={busy} onClick={() => { setForm({ ...empty, stepNumber: topic.lessons.length + 1 }); setLessonId(null); setStatus(''); }}>Add a lesson</button>}
      </aside>
      <section className="min-w-0">{topic ? <><form onSubmit={save} className="space-y-5" aria-busy={busy}><fieldset disabled={busy} className="space-y-5"><div className="grid gap-4 sm:grid-cols-[1fr_100px]"><label className="field">Lesson title<input className="input" value={form.title} required maxLength={250} onChange={e => setForm({ ...form, title: e.target.value })} /></label><label className="field">Step<input className="input" type="number" min={1} max={10000} value={form.stepNumber} required onChange={e => setForm({ ...form, stepNumber: Number(e.target.value) })} /></label></div>
          <label className="field">Lesson URL slug<input className="input" value={form.slug} required maxLength={150} pattern="[a-z0-9]+(-[a-z0-9]+)*" onChange={e => setForm({ ...form, slug: e.target.value })} /><span className="field-help">Lowercase letters, numbers, and hyphens. Changing this creates a separate lesson.</span></label>
          <label className="surface flex min-h-11 items-start gap-3 p-4"><input className="mt-1 h-5 w-5 accent-accent" type="checkbox" checked={form.exclusive} onChange={e => setForm({ ...form, exclusive: e.target.checked })} /><span><span className="block text-base font-medium">Exclusive lesson</span><span className="block text-sm text-muted">Only roles with exclusive access can read this lesson or download its resources. Approved businesses have this access by default.</span></span></label>
          <div className="flex items-center justify-between"><h2 className="font-semibold">Lesson content</h2><button className="btn-quiet" type="button" aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? 'Edit Markdown' : 'Preview lesson'}</button></div>
          {preview ? <div className="surface prose min-h-80 max-w-none overflow-auto p-6"><ReactMarkdown remarkPlugins={[remarkGfm]}>{form.contentMd || 'Your lesson preview will appear here.'}</ReactMarkdown></div> : <label className="field"><span className="sr-only">Markdown lesson content</span><textarea className="input min-h-[420px] py-4 font-mono text-sm" placeholder="Write your lesson in Markdown…" value={form.contentMd} required maxLength={500000} onChange={e => setForm({ ...form, contentMd: e.target.value })} /></label>}
          <p className="text-sm text-muted">Attach videos, guides, and large files as resources after saving the lesson.</p><button className="btn" disabled={busy || !form.contentMd.trim()}>{busy ? 'Saving…' : 'Save lesson'}</button></fieldset></form>{lessonId && <LessonAssets key={lessonId} lessonId={lessonId} manage />}</> : <div className="surface px-7 py-14"><h2 className="text-2xl font-semibold">A good lesson starts with a topic.</h2><p className="mt-3 text-base text-muted">Choose a topic to edit its lessons, set access, and attach learning resources.</p></div>}</section>
    </div>
  </div>;
}
