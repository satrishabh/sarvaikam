import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link, useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { api, Lesson } from '../api';
import { useAuth } from '../auth';

export default function LessonPage() {
  const { topicSlug = '', lessonSlug = '' } = useParams();
  const { user } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLesson(null);
    window.scrollTo(0, 0);
    api.lesson(topicSlug, lessonSlug).then(setLesson).catch((e) => setError(e.message));
  }, [topicSlug, lessonSlug]);

  useEffect(() => {
    if (!user || !lesson) return setCompleted(false);
    api.topicProgress(topicSlug)
      .then((p) => setCompleted(p.completedLessonIds.includes(lesson.id)))
      .catch(() => {});
  }, [user, lesson, topicSlug]);

  const toggle = async () => {
    if (!lesson) return;
    setSaving(true);
    try {
      if (completed) await api.uncomplete(lesson.id);
      else await api.complete(lesson.id, topicSlug);
      setCompleted(!completed);
    } finally {
      setSaving(false);
    }
  };

  if (error) return (
    <div className="py-20 text-center">
      <h1 className="text-3xl font-semibold">This step couldn't be loaded</h1>
      <p className="mt-2 text-muted">{error}</p>
      <Link to={`/topics/${topicSlug}`} className="link mt-4 inline-block">Back to the topic</Link>
    </div>
  );
  if (!lesson) return <div className="mx-auto max-w-read space-y-4"><div className="skeleton h-10 w-3/4" />{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-5" />)}</div>;

  const progress = Math.round((lesson.stepNumber / lesson.totalSteps) * 100);

  return (
    <article className="mx-auto max-w-read pb-28">
      <Link to={`/topics/${topicSlug}`} className="link text-[15px]">{lesson.topicName}</Link>
      <p className="mt-6 text-[15px] tabular-nums text-muted">Step {lesson.stepNumber} of {lesson.totalSteps}</p>
      <h1 className="mt-1 text-[40px] font-semibold leading-tight tracking-tightest">{lesson.title}</h1>

      {/* react-markdown does not render raw HTML, so lesson content cannot inject scripts */}
      <div className="prose prose-lg mt-8 max-w-none prose-headings:font-display prose-headings:tracking-tight prose-headings:text-ink
                      prose-p:text-ink/90 prose-a:text-accent prose-strong:text-ink prose-code:rounded prose-code:bg-track prose-code:px-1.5
                      prose-code:py-0.5 prose-code:font-normal prose-code:text-ink prose-code:before:content-none prose-code:after:content-none
                      prose-pre:rounded-2xl prose-pre:bg-ink prose-pre:text-[14px] prose-li:text-ink/90
                      prose-blockquote:border-accent prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:text-muted
                      [&_blockquote_p]:before:content-none [&_blockquote_p]:after:content-none
                      [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-white">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{lesson.contentMd}</ReactMarkdown>
      </div>

      {/* Sticky step bar: the one persistent control on a reading page. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line/80 bg-canvas/85 backdrop-blur-xl">
        <div className="h-0.5 bg-track"><div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${progress}%` }} /></div>
        <div className="mx-auto flex max-w-[1080px] items-center gap-2 px-5 py-3">
          {lesson.previous
            ? <Link className="btn-quiet max-w-[35%]" to={`/topics/${topicSlug}/${lesson.previous.slug}`}>
                <span className="truncate">Previous<span className="hidden md:inline">: {lesson.previous.title}</span></span>
              </Link>
            : <span className="flex-1 md:flex-none" />}
          <div className="mx-auto">
            {user ? (
              <button onClick={toggle} disabled={saving} aria-pressed={completed}
                      className={completed ? 'btn-quiet bg-gold-soft hover:bg-gold-soft' : 'btn'}>
                {completed ? <><span aria-hidden className="text-gold">★</span> Step complete</> : 'Mark step complete'}
              </button>
            ) : (
              <Link to="/login" className="btn-quiet">Sign in to save progress</Link>
            )}
          </div>
          {lesson.next
            ? <Link className="btn-quiet max-w-[35%]" to={`/topics/${topicSlug}/${lesson.next.slug}`}>
                <span className="truncate">Next<span className="hidden md:inline">: {lesson.next.title}</span></span>
              </Link>
            : <Link className="btn-quiet" to={`/topics/${topicSlug}`}>Finish topic</Link>}
        </div>
      </div>
    </article>
  );
}
