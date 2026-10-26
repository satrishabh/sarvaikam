import { FormEvent, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, Category, Topic } from '../api';
import { useAuth } from '../auth';

const empty = { slug: '', title: '', stepNumber: 1, contentMd: '' };

/** Minimal CMS: pick a topic, then create/edit/delete its step-by-step lessons. */
export default function AdminPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [topicSlug, setTopicSlug] = useState('');
  const [topic, setTopic] = useState<Topic | null>(null);
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState('');

  useEffect(() => {
    api.categories().then(setCategories).catch(() => {});
  }, []);

  const loadTopic = (slug: string) => {
    setTopicSlug(slug);
    setForm(empty);
    if (slug) api.topic(slug).then(setTopic);
    else setTopic(null);
  };

  if (user?.role !== 'ADMIN') return <p className="py-20 text-center text-muted">Only admins can edit lessons. Sign in with an admin account.</p>;

  const edit = async (lessonSlug: string) => {
    const l = await api.lesson(topicSlug, lessonSlug);
    setForm({ slug: l.slug, title: l.title, stepNumber: l.stepNumber, contentMd: l.contentMd });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.upsertLesson({ topicSlug, ...form });
      setStatus('Lesson saved.');
      loadTopic(topicSlug);
    } catch (err) {
      setStatus((err as Error).message);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this lesson?')) return;
    await api.deleteLesson(id);
    loadTopic(topicSlug);
  };

  return (
    <div className="space-y-8"><h1 className="text-[40px] font-semibold tracking-tightest">Edit lessons</h1><div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-3">
        <select className="input" value={topicSlug} onChange={(e) => loadTopic(e.target.value)}>
          <option value="">Choose a topic</option>
          {categories.map((c) => (
            <optgroup key={c.id} label={c.name}>
              {c.topics.map((t) => <option key={t.id} value={t.slug}>{t.name}</option>)}
            </optgroup>
          ))}
        </select>
        {topic?.lessons.map((l) => (
          <div key={l.id} className="flex items-center gap-2 text-sm">
            <button className="flex-1 rounded-lg px-2 py-1.5 text-left hover:bg-track hover:text-accent" onClick={() => edit(l.slug)}>
              {l.stepNumber}. {l.title}
            </button>
            <button className="rounded-lg px-2 py-1.5 text-danger hover:bg-track" onClick={() => remove(l.id)}>Delete</button>
          </div>
        ))}
        {topic && <button className="btn-quiet w-full border border-line" onClick={() => setForm({ ...empty, stepNumber: topic.lessons.length + 1 })}>Add a step</button>}
      </aside>

      {topic ? (
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_100px]">
            <input className="input" placeholder="Title" value={form.title} required
                   onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input className="input" placeholder="slug-like-this" value={form.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*"
                   onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            <input className="input" type="number" min={1} value={form.stepNumber}
                   onChange={(e) => setForm({ ...form, stepNumber: Number(e.target.value) })} />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <textarea className="input h-[60vh] font-mono text-sm" placeholder="Markdown content" value={form.contentMd} required
                      onChange={(e) => setForm({ ...form, contentMd: e.target.value })} />
            <div className="surface prose h-[60vh] max-w-none overflow-auto p-5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{form.contentMd}</ReactMarkdown>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn">Save lesson</button>
            <span role="status" className="text-[15px] text-muted">{status}</span>
          </div>
        </form>
      ) : (
        <p className="text-muted">Choose a topic to edit its steps.</p>
      )}
    </div></div>
  );
}
