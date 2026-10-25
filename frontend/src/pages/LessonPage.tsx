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
  const [error, setError] = useState('');

  useEffect(() => {
    setLesson(null);
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
    if (completed) await api.uncomplete(lesson.id);
    else await api.complete(lesson.id, topicSlug);
    setCompleted(!completed);
  };

  if (error) return <p className="text-rose-400">{error}</p>;
  if (!lesson) return <p>Loading...</p>;

  return (
    <article className="mx-auto max-w-3xl">
      <Link to={`/topics/${topicSlug}`} className="text-sm text-indigo-400">&larr; {lesson.topicName} roadmap</Link>
      <p className="mt-4 text-sm text-slate-500">Step {lesson.stepNumber} of {lesson.totalSteps}</p>
      <h1 className="text-3xl font-bold">{lesson.title}</h1>

      {/* react-markdown does not render raw HTML, so lesson content cannot inject scripts */}
      <div className="prose prose-invert mt-6 max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{lesson.contentMd}</ReactMarkdown>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-6">
        {lesson.previous && (
          <Link className="btn-ghost" to={`/topics/${topicSlug}/${lesson.previous.slug}`}>&larr; {lesson.previous.title}</Link>
        )}
        {user ? (
          <button className={completed ? 'btn-ghost' : 'btn'} onClick={toggle}>
            {completed ? '✓ Completed (undo)' : 'Mark as complete'}
          </button>
        ) : (
          <Link to="/login" className="text-sm text-slate-400 underline">Login to track progress</Link>
        )}
        {lesson.next && (
          <Link className="btn-ghost ml-auto" to={`/topics/${topicSlug}/${lesson.next.slug}`}>{lesson.next.title} &rarr;</Link>
        )}
      </div>
    </article>
  );
}
