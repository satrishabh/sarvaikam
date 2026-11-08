import {
  Children,
  isValidElement,
  ReactNode,
  useEffect,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import { Link, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { api, Lesson, Topic } from "../api";
import { useAuth } from "../auth";
import LessonAssets from "../components/LessonAssets";
import Icon from "../components/Icon";
import { readingMinutes } from "../engagement";

function CodeBlock({ children }: { children?: ReactNode }) {
  const [status, setStatus] = useState("");
  const copy = async () => {
    const child = Children.toArray(children).find(isValidElement);
    const text = child
      ? String((child.props as { children?: ReactNode }).children ?? "")
      : "";
    try {
      await navigator.clipboard.writeText(text.replace(/\n$/, ""));
      setStatus("Copied");
    } catch {
      setStatus("Select the code to copy it");
    }
  };
  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-line bg-[#102c43]">
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-white/10 px-4 text-[11px] text-[#c2cfdb]">
        <span>Code example</span>
        <button
          className="min-h-11 px-2 font-medium text-[#a4ded2]"
          onClick={() => void copy()}
        >
          Copy code
        </button>
        <span className="sr-only" role="status">
          {status}
        </span>
      </div>
      <pre className="!m-0 overflow-x-auto !rounded-none !bg-transparent !p-5 text-[13px] leading-relaxed text-white">
        {children}
      </pre>
      {status && <p className="px-5 pb-3 text-xs text-[#a4ded2]">{status}</p>}
    </div>
  );
}
export default function LessonPage() {
  const { topicSlug = "", lessonSlug = "" } = useParams();
  const { user, ready } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [completedIds, setCompletedIds] = useState<number[]>([]);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [fontSize, setFontSize] = useState(18);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLesson(null);
    setError("");
    setSaveError("");
    api
      .lesson(topicSlug, lessonSlug)
      .then((data) => {
        if (active) setLesson(data);
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, [
    topicSlug,
    lessonSlug,
    ready,
    user?.id,
    user?.role,
    user?.permissions.join("|"),
    attempt,
  ]);
  useEffect(() => {
    let active = true;
    setTopic(null);
    api
      .topic(topicSlug)
      .then((data) => {
        if (active) setTopic(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [topicSlug]);
  useEffect(() => {
    let active = true;
    setCompleted(false);
    setCompletedIds([]);
    setChecking(true);
    setSaveError("");
    if (!user || !lesson) {
      setChecking(false);
      return;
    }
    api
      .topicProgress(topicSlug)
      .then((data) => {
        if (active) {
          setCompletedIds(data.completedLessonIds);
          setCompleted(data.completedLessonIds.includes(lesson.id));
        }
      })
      .catch(() => {
        if (active)
          setSaveError(
            "Your saved progress could not be loaded. Retry before changing this lesson’s completion.",
          );
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id, lesson?.id, topicSlug, attempt]);
  const toggle = async () => {
    if (!lesson) return;
    setSaving(true);
    setSaveError("");
    try {
      if (completed) await api.uncomplete(lesson.id);
      else await api.complete(lesson.id, topicSlug);
      setCompletedIds((ids) =>
        completed
          ? ids.filter((id) => id !== lesson.id)
          : [...new Set([...ids, lesson.id])],
      );
      setCompleted(!completed);
    } catch (cause) {
      setSaveError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  };
  if (error)
    return (
      <div className="surface mx-auto max-w-2xl p-9">
        <p className="eyebrow">LESSON UNAVAILABLE</p>
        <h1 className="mt-3 text-3xl font-semibold">
          Let’s find your next step.
        </h1>
        <p className="mt-4 text-muted">{error}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link className="btn" to={`/topics/${topicSlug}`}>
            Back to the topic
          </Link>
          <Link className="outline-btn" to={user ? "/profile" : "/login"}>
            {user ? "Check your access" : "Sign in"}
          </Link>
          <button
            className="btn-quiet"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Retry lesson
          </button>
        </div>
      </div>
    );
  if (!lesson)
    return (
      <div
        className="mx-auto max-w-read space-y-5"
        role="status"
        aria-label="Loading lesson"
      >
        <div className="skeleton h-10 w-3/4" />
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="skeleton h-5" />
        ))}
      </div>
    );
  const sequence = (
    <nav aria-label="Topic lessons" className="mt-4 space-y-1">
      {topic?.lessons.map((item, i) => (
        <Link
          key={item.id}
          to={`/topics/${topicSlug}/${item.slug}`}
          aria-current={item.id === lesson.id ? "page" : undefined}
          className={`flex min-h-11 items-start gap-2 rounded-lg p-2.5 text-xs ${item.id === lesson.id ? "bg-accent-soft font-semibold text-accent-strong" : "text-muted hover:bg-track"}`}
        >
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center font-mono text-[10px]">
            {completedIds.includes(item.id) ? (
              <Icon name="check" className="h-3.5 w-3.5 text-accent" />
            ) : (
              String(i + 1).padStart(2, "0")
            )}
          </span>
          <span>{item.title}</span>
        </Link>
      ))}
    </nav>
  );
  return (
    <div className="grid items-start gap-9 pb-24 lg:grid-cols-[230px_1fr] xl:gap-14">
      <aside className="hidden lg:sticky lg:top-28 lg:block">
        <Link
          to={`/topics/${topicSlug}`}
          className="link inline-flex min-h-11 items-center gap-2 text-xs"
        >
          <Icon name="chevron" className="h-3 w-3 rotate-180" />
          Back to {lesson.topicName}
        </Link>
        <p className="mt-6 text-[10px] font-semibold uppercase tracking-widest text-muted">
          IN THIS TOPIC
        </p>
        {sequence}
        <Link
          className="mt-7 flex items-center gap-2 rounded-xl border border-line bg-surface p-4 text-xs font-medium text-accent"
          to="/practice"
        >
          <Icon name="target" className="h-4 w-4" />
          Put it into practice
        </Link>
      </aside>
      <article className="min-w-0 max-w-[76ch]">
        <div className="lg:hidden">
          <details className="surface mb-6 p-4">
            <summary className="cursor-pointer text-sm font-medium">
              {lesson.topicName} · Lesson {lesson.stepNumber} of{" "}
              {lesson.totalSteps}
            </summary>
            {sequence}
            <Link
              to={`/topics/${topicSlug}`}
              className="link mt-4 inline-block text-xs"
            >
              View topic overview
            </Link>
          </details>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span>
            LESSON {lesson.stepNumber} / {lesson.totalSteps}
          </span>
          <span className="h-1 w-1 rounded-full bg-line" />
          <span className="flex items-center gap-1.5">
            <Icon name="clock" className="h-3.5 w-3.5" />
            About {readingMinutes(lesson.contentMd)} min reading
          </span>
          {lesson.exclusive && <span className="badge">Exclusive</span>}
        </div>
        <h1 className="mt-5 text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.15] tracking-tightest">
          {lesson.title}
        </h1>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-line py-3">
          <Link
            to={`/topics/${topicSlug}`}
            className="text-xs font-medium text-accent"
          >
            {lesson.topicName}
          </Link>
          <div
            role="group"
            aria-label="Reading text size"
            className="flex items-center gap-2"
          >
            <span className="mr-2 text-[11px] text-muted">Text size</span>
            {[16, 18, 20].map((size, i) => (
              <button
                key={size}
                className={`flex h-11 w-11 items-center justify-center rounded-lg text-xs ${fontSize === size ? "bg-ink text-white" : "bg-track"}`}
                onClick={() => setFontSize(size)}
                aria-label={`${["Small", "Medium", "Large"][i]} reading text`}
                aria-pressed={fontSize === size}
              >
                A
                <span className="ml-0.5 text-[9px]">
                  {i === 0 ? "−" : i === 2 ? "+" : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
        {saveError && (
          <div
            role="alert"
            className="mt-5 rounded-xl bg-danger/5 p-4 text-sm text-danger"
          >
            <p>{saveError}</p>
            <button
              className="link mt-2 min-h-11"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Reload progress
            </button>
          </div>
        )}
        <div
          style={{ fontSize }}
          className="prose mt-8 max-w-none leading-[1.85] prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-ink prose-p:text-ink/90 prose-a:text-accent prose-strong:text-ink prose-code:rounded prose-code:bg-track prose-code:px-1 prose-code:font-normal prose-code:text-ink prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-xl prose-li:text-ink/90 prose-blockquote:border-accent prose-blockquote:font-normal prose-blockquote:text-muted prose-table:text-sm [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-white [&_img]:max-w-full [&_table]:block [&_table]:overflow-auto"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
            }}
          >
            {lesson.contentMd}
          </ReactMarkdown>
        </div>
        <section className="mt-10 rounded-2xl border border-accent/15 bg-accent-soft p-6">
          <p className="eyebrow">BEFORE YOU MOVE ON</p>
          <h2 className="mt-3 text-xl font-semibold">
            Explain one idea without your notes.
          </h2>
          <p className="mt-3 text-sm text-muted">
            What did you learn? Where would you use it? What assumption would
            change your answer? If something feels unclear, revisit the example
            before marking the lesson complete.
          </p>
        </section>
        <LessonAssets key={lesson.id} lessonId={lesson.id} />
      </article>
      <div className="reading-controls fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-2 px-5 py-3 sm:px-8">
          <div className="hidden max-w-[30%] text-xs lg:block">
            <p className="truncate font-medium">{lesson.topicName}</p>
            <p className="text-muted">
              Lesson {lesson.stepNumber} of {lesson.totalSteps}
            </p>
          </div>
          <div className="flex w-full items-center justify-between gap-2 lg:w-auto">
            {lesson.previous ? (
              <Link
                className="btn-quiet px-3 text-xs"
                to={`/topics/${topicSlug}/${lesson.previous.slug}`}
              >
                <Icon name="chevron" className="h-4 w-4 rotate-180" />
                <span className="hidden sm:inline">Previous</span>
              </Link>
            ) : (
              <Link
                to={`/topics/${topicSlug}`}
                className="btn-quiet px-3 text-xs"
              >
                Overview
              </Link>
            )}
            {user ? (
              <button
                onClick={() => void toggle()}
                disabled={saving || checking || !!saveError}
                aria-pressed={completed}
                className={
                  completed
                    ? "outline-btn px-4 text-xs text-accent"
                    : "btn px-4 text-xs"
                }
              >
                {completed && <Icon name="check" className="h-4 w-4" />}
                {saving
                  ? "Saving…"
                  : checking
                    ? "Loading progress…"
                    : completed
                      ? "Lesson complete"
                      : "Mark complete"}
              </button>
            ) : (
              <Link to="/login" className="btn px-4 text-xs">
                Sign in to save
              </Link>
            )}
            {lesson.next ? (
              <Link
                className="btn-quiet px-3 text-xs"
                to={`/topics/${topicSlug}/${lesson.next.slug}`}
              >
                <span>Next</span>
                <Icon name="chevron" className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                className="btn-quiet px-3 text-xs"
                to={`/topics/${topicSlug}`}
              >
                Finish topic
                <Icon name="check" className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
