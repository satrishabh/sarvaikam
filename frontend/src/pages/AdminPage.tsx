import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, can, Category, Topic, LearningStage } from '../api';
import { useAuth } from '../auth';
import LessonAssets from '../components/LessonAssets';
import ReelEditor from '../components/ReelEditor';
import CourseEditor from '../components/CourseEditor';
import PathEditor from '../components/PathEditor';
import LessonComposer from '../components/LessonComposer';
import { authoringSlug } from '../authoring';
import { learningStages, stageName } from '../learning';

const empty = { slug: '', title: '', stepNumber: 1, contentMd: '', exclusive: false, stage: 'STARTER' as LearningStage };
const areas = [
  { id: 'courses', title: '1. Courses & subjects', help: 'Create and organize your courses.' },
  { id: 'lessons', title: '2. Lesson steps & uploads', help: 'Write sections, import text, attach files.' },
  { id: 'reels', title: '3. Reels', help: 'Create short content with its source.' },
  { id: 'paths', title: '4. Learning paths', help: 'Arrange courses and change priority.' },
] as const;
type Area = typeof areas[number]['id'];
export default function AdminPage() {
  const { user, ready } = useAuth();
  const [area, setArea] = useState<Area>('courses');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [topicSlug, setTopicSlug] = useState('');
  const [topic, setTopic] = useState<Topic | null>(null);
  const [form, setForm] = useState(empty);
  const [saved, setSaved] = useState(JSON.stringify(empty));
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const dirty = JSON.stringify(form) !== saved;
  const refresh = async () => { setCategories(await api.categories()); setLoaded(true); };
  useEffect(() => {
    if (!ready || !can(user, 'content.manage')) return;
    let active = true;
    api.categories().then(items => { if (active) { setCategories(items); setLoaded(true); } }).catch(cause => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [ready, user?.id]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const reset = (next = empty) => { setForm(next); setSaved(JSON.stringify(next)); setLessonId(null); setPreview(false); setRevision(n => n + 1); };
  const discard = () => !dirty || confirm('Discard the unsaved lesson changes?');
  const loadTopic = async (slug: string) => {
    if (!discard()) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const next = slug ? await api.topic(slug) : null;
      setTopicSlug(slug); setTopic(next); reset({ ...empty, stepNumber: next ? Math.max(0, ...next.lessons.map(l => l.stepNumber)) + 1 : 1 });
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  if (!ready) return <p role="status">Loading admin access…</p>;
  if (!user) return <section className="surface space-y-4 p-8"><h1 className="text-3xl font-semibold">Admin content studio</h1><p className="text-muted">Sign in with an account that can manage content to add courses, upload lessons, and publish reels.</p><Link className="btn" to="/login?next=/admin">Sign in to admin</Link></section>;
  if (!can(user, 'content.manage')) return <section className="surface space-y-3 p-8"><h1 className="text-2xl font-semibold">Content access required</h1><p>Your account needs permission to manage content.</p><Link className="link" to="/profile">View your access</Link></section>;
  const edit = async (slug: string) => {
    if (!discard()) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const lesson = await api.lesson(topicSlug, slug);
      const next = { slug: lesson.slug, title: lesson.title, stepNumber: lesson.stepNumber, contentMd: lesson.contentMd, exclusive: lesson.exclusive, stage: lesson.stage ?? 'STARTER' };
      reset(next); setLessonId(lesson.id);
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setStatus('');
    try {
      if (!lessonId && topic?.lessons.some(l => l.slug === form.slug)) throw new Error('That lesson URL already exists. Choose the existing step to edit it, or use a different URL.');
      const lesson = await api.upsertLesson({ topicSlug, ...form, title: form.title.trim() });
      setLessonId(lesson.id); setSaved(JSON.stringify(form)); setStatus('Lesson saved and available to its readers. Upload resources below, or open the lesson to review it.');
      setTopic(await api.topic(topicSlug)); await refresh();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  const remove = async (id: number) => {
    if (!discard() || !confirm('Delete this lesson and its resource links? This cannot be undone.')) return;
    setBusy(true); setError('');
    try { await api.deleteLesson(id); setTopic(await api.topic(topicSlug)); reset(); await refresh(); setStatus('Lesson deleted.'); }
    catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  return <div className="space-y-7">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">ADMIN WORKSPACE</p><h1 className="mt-3 text-4xl font-semibold tracking-tightest">Content studio</h1><p className="mt-2 text-muted">Create, upload, and organize content here. No SQL or cloud console needed.</p></div>{can(user, 'candidates.view') && <Link className="outline-btn" to="/admin/users">Manage people</Link>}</header>
    <nav aria-label="Content studio tools" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{areas.map(item => <button type="button" key={item.id} disabled={busy} aria-pressed={area === item.id} className={`surface min-h-24 p-4 text-left ${area === item.id ? 'border-accent bg-accent-soft' : ''}`} onClick={() => { setArea(item.id); setStatus(''); setError(''); }}><span className="block font-semibold">{item.title}</span><span className="mt-1 block text-sm text-muted">{item.help}</span></button>)}</nav>
    {error && <p role="alert" className="rounded-xl bg-danger/5 p-4 text-danger">{error}{!loaded && <button type="button" className="link ml-3" onClick={() => { setError(''); void refresh().catch(e => setError(e.message)); }}>Retry loading</button>}</p>}
    {status && <p role="status" className="rounded-xl bg-accent-soft p-4">{status}</p>}
    {!loaded && !error ? <p role="status">Loading your courses…</p> : loaded && <>
      {area === 'courses' && <CourseEditor categories={categories} refresh={refresh} openLessons={slug => { setArea('lessons'); void loadTopic(slug); }} />}
      {area === 'paths' && <PathEditor categories={categories} />}
      {area === 'reels' && <ReelEditor categories={categories} />}
      {area === 'lessons' && <div className="grid items-start gap-7 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4"><label className="field">Choose a course<select className="input" value={topicSlug} disabled={busy} onChange={event => void loadTopic(event.target.value)}><option value="">Select a course</option>{categories.map(category => <optgroup key={category.id} label={category.name}>{category.topics.map(t => <option key={t.id} value={t.slug}>{t.name}</option>)}</optgroup>)}</select></label>
          <button type="button" className="link text-sm" onClick={() => setArea('courses')}>+ Create a course</button>
          <ol className="space-y-2">{topic?.lessons.map(lesson => <li key={lesson.id} className={`surface p-2 ${lessonId === lesson.id ? 'border-accent' : ''}`}><button type="button" className="min-h-11 w-full rounded-lg px-2 py-2 text-left text-sm font-medium hover:bg-track" disabled={busy} onClick={() => void edit(lesson.slug)}>{lesson.stepNumber}. {lesson.title}</button><div className="flex items-center justify-between px-2"><span className="text-xs text-muted">{stageName(lesson.stage)} · {lesson.exclusive ? 'Exclusive' : 'Standard'}</span><button className="btn-quiet text-danger" disabled={busy} onClick={() => void remove(lesson.id)}>Delete</button></div></li>)}</ol>
          {topic && <button type="button" className="outline-btn w-full" disabled={busy} onClick={() => { if (discard()) { reset({ ...empty, stepNumber: Math.max(0, ...topic.lessons.map(l => l.stepNumber)) + 1 }); setStatus(''); } }}>+ Add lesson step</button>}
        </aside>
        <section className="min-w-0">{topic ? <><form onSubmit={save} className="space-y-5" aria-busy={busy}><fieldset disabled={busy} className="space-y-5">
          <div><p className="eyebrow">{topic.name}</p><h2 className="mt-2 text-2xl font-semibold">{lessonId ? 'Edit lesson step' : 'Add a lesson step'}</h2></div>
          <div className="grid gap-4 sm:grid-cols-[1fr_100px]"><label className="field">Heading<input className="input" value={form.title} required maxLength={250} onChange={e => setForm({ ...form, title: e.target.value, slug: lessonId ? form.slug : authoringSlug(e.target.value, 150) })} /></label><label className="field">Step<input className="input" type="number" min={1} max={10000} value={form.stepNumber} required onChange={e => setForm({ ...form, stepNumber: Number(e.target.value) })} /></label></div>
          <label className="field">Learning level<select className="input" value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value as LearningStage })}>{learningStages.map(stage => <option key={stage.key} value={stage.key}>{stage.name}</option>)}</select></label>
          <label className="surface flex items-start gap-3 p-4"><input className="mt-1 h-5 w-5 accent-accent" type="checkbox" checked={form.exclusive} onChange={e => setForm({ ...form, exclusive: e.target.checked })} /><span><span className="block font-medium">Exclusive lesson</span><span className="block text-sm text-muted">Require exclusive access. Standard lessons are public as soon as you save them.</span></span></label>
          <div className="flex items-center justify-between"><h3 className="font-semibold">Lesson content</h3><button className="btn-quiet" type="button" aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? 'Continue editing' : 'Preview lesson'}</button></div>
          {preview ? <div className="surface prose min-h-80 max-w-none overflow-auto p-6"><ReactMarkdown remarkPlugins={[remarkGfm]}>{form.contentMd || 'Your lesson preview will appear here.'}</ReactMarkdown></div> : <LessonComposer key={revision} value={form.contentMd} onChange={contentMd => setForm(f => ({ ...f, contentMd }))} onImporting={setBusy} />}
          <details><summary className="cursor-pointer text-sm text-muted">Lesson URL</summary><label className="field mt-3">URL name<input className="input" value={form.slug} required disabled={!!lessonId} maxLength={150} pattern="[a-z0-9]+(-[a-z0-9]+)*" onChange={e => setForm({ ...form, slug: e.target.value })} /><span className="field-help">Generated from the heading. Existing lesson URLs stay fixed.</span></label></details>
          <p className="text-sm text-muted">Saving makes this step available to its readers. Preview before saving, then upload any resources below.</p>
          <div className="flex flex-wrap items-center gap-4"><button className="btn" disabled={busy || !form.contentMd.trim() || form.contentMd.length > 500000 || !form.slug}>{busy ? 'Saving…' : lessonId ? 'Save changes' : 'Publish lesson step'}</button>{lessonId && <Link className="link" to={`/topics/${topicSlug}/${form.slug}`}>Open saved lesson →</Link>}{dirty && <span className="text-xs text-muted">Unsaved changes</span>}</div>
        </fieldset></form>{lessonId && <LessonAssets key={lessonId} lessonId={lessonId} manage />}</> : <div className="surface px-7 py-14"><h2 className="text-2xl font-semibold">Choose a course to add its steps.</h2><p className="mt-3 text-muted">Write your lesson in sections or upload a text file. Attach PDFs and videos after saving.</p><button type="button" className="outline-btn mt-5" onClick={() => setArea('courses')}>Create a course</button></div>}</section>
      </div>}
    </>}
  </div>;
}
