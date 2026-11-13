import { FormEvent, useState } from 'react';
import { api, Category } from '../api';
import { authoringSlug } from '../authoring';

export default function CourseEditor({ categories, refresh, openLessons }: {
  categories: Category[]; refresh: () => Promise<void>; openLessons: (slug: string) => void;
}) {
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState({ categorySlug: '', slug: '', name: '', summary: '', level: 'BEGINNER', sortOrder: categories.reduce((n, c) => n + c.topics.length, 0) });
  const [subject, setSubject] = useState({ slug: '', name: '', description: '', icon: 'book', sortOrder: categories.length });
  const [subjectSelected, setSubjectSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const courses = categories.flatMap(c => c.topics);
  const choose = (slug: string) => {
    const course = courses.find(t => t.slug === slug);
    setSelected(slug); setStatus(''); setError('');
    setForm(course ? { categorySlug: course.categorySlug, slug: course.slug, name: course.name, summary: course.summary ?? '', level: course.level, sortOrder: categories.find(c => c.slug === course.categorySlug)?.topics.findIndex(t => t.slug === slug) ?? 0 }
      : { categorySlug: categories[0]?.slug ?? '', slug: '', name: '', summary: '', level: 'BEGINNER', sortOrder: courses.length });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setStatus('');
    try {
      if (!selected && courses.some(c => c.slug === form.slug)) throw new Error('A course with this URL already exists. Select it above to edit it, or choose a different URL.');
      await api.saveCourse({ ...form, name: form.name.trim() });
      setSelected(form.slug); setStatus('Course saved. Continue to add its lesson steps.');
      await refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const saveSubject = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setStatus('');
    try {
      if (!subjectSelected && categories.some(c => c.slug === subject.slug)) throw new Error('A subject with this URL already exists. Select it above to edit it.');
      await api.saveCategory({ ...subject, name: subject.name.trim() });
      setSubjectSelected(subject.slug); setForm(f => ({ ...f, categorySlug: subject.slug }));
      setStatus('Subject saved. You can now create a course under it.'); await refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
    <section className="surface space-y-5 p-6">
      <h2 className="text-2xl font-semibold">Create or update a course</h2>
      <p className="text-sm text-muted">Give the course a name, choose its subject, then add lesson steps. Use Learning paths to put it in an engineering sequence.</p>
      {error && <p role="alert" className="text-danger">{error}</p>}{status && <p role="status" className="rounded-xl bg-accent-soft p-4">{status}</p>}
      <label className="field">Course to edit<select className="input" value={selected} disabled={busy} onChange={e => choose(e.target.value)}><option value="">Create a new course</option>{courses.map(t => <option key={t.slug} value={t.slug}>{t.name}</option>)}</select></label>
      <form onSubmit={save}><fieldset disabled={busy} className="space-y-4">
        <label className="field">Course name<input className="input" required maxLength={200} value={form.name} onChange={e => setForm({ ...form, name: e.target.value, slug: selected ? form.slug : authoringSlug(e.target.value) })} /></label>
        <label className="field">Subject<select aria-label="Subject" className="input" required value={form.categorySlug} onChange={e => setForm({ ...form, categorySlug: e.target.value })}><option value="">Choose a subject</option>{categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
        <label className="field">Course summary<textarea className="input min-h-28" maxLength={10000} value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} /></label>
        <label className="field">Starting level<select className="input" value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}><option value="BEGINNER">Beginner</option><option value="INTERMEDIATE">Intermediate</option><option value="ADVANCED">Advanced</option></select></label>
        <details><summary className="cursor-pointer text-sm text-muted">URL and display order</summary><div className="mt-3 space-y-3"><label className="field">Course URL<input className="input" required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" disabled={!!selected} value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /><span className="field-help">Generated from the name. Existing course URLs stay fixed.</span></label><label className="field">Display order<input className="input" type="number" min={0} value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} /></label></div></details>
        {!form.slug && form.name && <p className="text-sm text-danger">Enter an English URL name under URL and display order.</p>}
        <div className="flex flex-wrap gap-3"><button className="btn" disabled={!form.slug}>{busy ? 'Saving…' : 'Save course'}</button>{selected && <button type="button" className="outline-btn" onClick={() => openLessons(selected)}>Add lesson steps →</button>}</div>
      </fieldset></form>
    </section>
    <section className="surface space-y-5 p-6"><h2 className="text-xl font-semibold">Subjects</h2><p className="text-sm text-muted">Group courses under subjects such as AI, languages, or cloud.</p>
      <label className="field">Subject to edit<select className="input" disabled={busy} value={subjectSelected} onChange={e => { const item = categories.find(c => c.slug === e.target.value); setSubjectSelected(e.target.value); setSubject(item ? { slug: item.slug, name: item.name, description: item.description ?? '', icon: item.icon ?? 'book', sortOrder: categories.indexOf(item) } : { slug: '', name: '', description: '', icon: 'book', sortOrder: categories.length }); }}><option value="">Create a new subject</option>{categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
      <form onSubmit={saveSubject}><fieldset disabled={busy} className="space-y-4"><label className="field">Subject name<input className="input" required maxLength={200} value={subject.name} onChange={e => setSubject({ ...subject, name: e.target.value, slug: subjectSelected ? subject.slug : authoringSlug(e.target.value) })} /></label><label className="field">Description<textarea className="input min-h-28" maxLength={10000} value={subject.description} onChange={e => setSubject({ ...subject, description: e.target.value })} /></label><details><summary className="cursor-pointer text-sm text-muted">Subject URL</summary><input aria-label="Subject URL" className="input mt-3" required disabled={!!subjectSelected} maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={subject.slug} onChange={e => setSubject({ ...subject, slug: e.target.value })} /></details><button className="outline-btn" disabled={!subject.slug}>{busy ? 'Saving…' : 'Save subject'}</button></fieldset></form>
    </section>
  </div>;
}
