import { ReactNode, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useParams } from "react-router-dom";
import rehypeHighlight, { type Options as HighlightOptions } from "rehype-highlight";
import remarkGfm from "remark-gfm";
import bash from "highlight.js/lib/languages/bash";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { api, Category, Lesson, Topic } from "../api";
import { useAuth } from "../auth";
import LessonAssets from "../components/LessonAssets";
import QuickCheck from "../components/QuickCheck";
import Icon from "../components/Icon";
import { LearningPath, nextInPath, readFollowedPath, stageName } from "../learning";
import { PracticeQuestion, practiceForTopic } from "../practice";
import { readingMinutes } from "../engagement";
import { applyPageMeta, defaultDescription, describeMarkdown, lessonStructuredData } from "../seo";
import MobileSheet from "../components/MobileSheet";
import LessonOutline from "../components/LessonOutline";
import LessonSearch from "../components/LessonSearch";
import LessonCards from "../components/LessonCards";
import ReaderSettings from "../components/ReaderSettings";
import ReadingPosition from "../components/ReadingPosition";
import useReaderPreferences from "../useReaderPreferences";
import {
  lessonCards,
  outlineFromMarkdown,
  readResumePoint,
} from "../readingOutline";

// Only the languages lessons use, so the lesson chunk stays small. Fences without a language stay plain.
const highlightOptions: HighlightOptions = {
  languages: { bash, dockerfile, go, java, javascript, json, python, sql, typescript, xml, yaml },
  aliases: { bash: ["sh", "shell", "zsh"], javascript: ["js"], typescript: ["ts"], xml: ["html"], yaml: ["yml"] },
  plainText: ["text", "txt", "hcl", "promql"],
};

function CodeBlock({ children }: { children?: ReactNode }) {
  const [status, setStatus] = useState("");
  const pre = useRef<HTMLPreElement>(null);
  const copy = async () => {
    // Read the rendered text: highlighted code is a tree of spans, not one string.
    const text = pre.current?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text.replace(/\n$/, ""));
      setStatus("Copied");
    } catch {
      setStatus("Select the code to copy it");
    }
  };
  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-line bg-code-surface">
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-white/10 px-4 text-[11px] text-code-muted">
        <span>Code example</span>
        <button
          className="min-h-11 px-2 font-medium text-code-accent"
          onClick={() => void copy()}
        >
          Copy code
        </button>
        <span className="sr-only" role="status">
          {status}
        </span>
      </div>
      <pre
        ref={pre}
        tabIndex={0}
        role="region"
        aria-label="Scrollable code example"
        className="!m-0 overflow-x-auto !rounded-none !bg-transparent !p-5 text-[13px] leading-relaxed text-white"
      >
        {children}
      </pre>
      <p className="px-5 pb-3 text-xs !text-code-muted lg:hidden">
        Swipe sideways to read long lines of code.
      </p>
      {status && <p className="px-5 pb-3 text-xs text-code-accent">{status}</p>}
    </div>
  );
}
// Paths, catalogue and practice change rarely: load them once per visit for "what's next" links.
let journeyData: Promise<[LearningPath[], Category[], PracticeQuestion[]]> | null = null;
function loadJourneyData() {
  journeyData ??= Promise.all([api.paths(), api.categories(), api.practiceQuestions()]).catch((cause) => {
    journeyData = null;
    throw cause;
  });
  return journeyData;
}
interface Journey {
  next: ReturnType<typeof nextInPath>;
  practice?: PracticeQuestion;
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
  const {
    preferences,
    theme: activeTheme,
    saved: preferencesSaved,
    syncFailed: preferencesSyncFailed,
    change: changePreferences,
  } = useReaderPreferences();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [resumeId, setResumeId] = useState("");
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkError, setBookmarkError] = useState("");
  const [cardsOpen, setCardsOpen] = useState(false);
  const [journey, setJourney] = useState<Journey | null>(null);
  useEffect(() => {
    let active = true;
    setJourney(null);
    loadJourneyData()
      .then(([paths, categories, questions]) => {
        if (active)
          setJourney({
            next: nextInPath(topicSlug, paths, categories, readFollowedPath()),
            practice: practiceForTopic(topicSlug, questions),
          });
      })
      .catch(() => {}); // the plain topic and practice-room links still work
    return () => {
      active = false;
    };
  }, [topicSlug]);
  useEffect(() => {
    setResumeId(lesson ? (readResumePoint(lesson.id)?.id ?? "") : "");
  }, [lesson?.id]);
  useEffect(() => {
    setDetailsOpen(false);
    setSettingsOpen(false);
  }, [lessonSlug, topicSlug]);
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
  // Search and share metadata for this lesson. Exclusive lessons describe only their topic, so none of their
  // text reaches the page head.
  useEffect(() => {
    if (!lesson) return;
    const origin = window.location.origin;
    const url = `${origin}/topics/${lesson.topicSlug}/${lesson.slug}`;
    const title = `${lesson.title} · ${lesson.topicName} | Sarvaikam`;
    document.title = title;
    const summary = topic?.slug === lesson.topicSlug ? topic.summary : "";
    const description = (!lesson.exclusive && describeMarkdown(lesson.contentMd)) || summary || defaultDescription();
    applyPageMeta({
      title,
      description,
      url,
      structuredData: lesson.exclusive
        ? null
        : lessonStructuredData(
            {
              ...lesson,
              topicSummary: summary,
              level: topic?.slug === lesson.topicSlug ? topic.level : undefined,
              minutes: readingMinutes(lesson.contentMd),
            },
            origin,
            description,
          ),
    });
  }, [lesson, topic]);
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
  useEffect(() => {
    let active = true;
    setBookmarkError("");
    if (!user || !lesson) {
      setBookmarked(false);
      return;
    }
    api
      .bookmarks()
      .then((items) => {
        if (active) setBookmarked(items.some((item) => item.lessonId === lesson.id));
      })
      .catch(() => {
        if (active) setBookmarked(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id, lesson?.id]);
  const toggleBookmark = async () => {
    if (!lesson) return;
    setBookmarkError("");
    try {
      if (bookmarked) await api.unbookmark(lesson.id);
      else await api.bookmark(lesson.id, topicSlug);
      setBookmarked(!bookmarked);
    } catch (cause) {
      setBookmarkError((cause as Error).message);
    }
  };
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
  const outline = outlineFromMarkdown(lesson.contentMd);
  const headingIds = new Map(outline.map((item) => [item.line, item.id]));
  const headingId = (node?: { position?: { start: { line: number } } }) =>
    node?.position ? headingIds.get(node.position.start.line) : undefined;
  const resumeItem = outline.find((item) => item.id === resumeId);
  const practiceLink = journey?.practice
    ? `/practice?question=${encodeURIComponent(journey.practice.id)}`
    : "/practice";
  const nextTopic = journey?.next ?? null;
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
    <div className="reader-layout grid items-start gap-9 pb-24 lg:grid-cols-[230px_1fr] xl:gap-14">
      <ReadingPosition lessonId={lesson.id} />
      {cardsOpen && (
        <LessonCards
          cards={lessonCards(lesson.contentMd)}
          title={lesson.title}
          onClose={() => setCardsOpen(false)}
        />
      )}
      <MobileSheet
        open={detailsOpen}
        title="Lesson details"
        onClose={() => setDetailsOpen(false)}
      >
        <p className="text-lg font-semibold">{lesson.topicName}</p>
        <p className="mt-2 text-sm text-muted">
          Lesson {lesson.stepNumber} of {lesson.totalSteps}. Choose a lesson to
          continue.
        </p>
        <div
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a"))
              setDetailsOpen(false);
          }}
        >
          {sequence}
          <LessonSearch markdown={lesson.contentMd} />
          <LessonOutline items={outline} />
          <Link to={`/topics/${topicSlug}`} className="outline-btn mt-5 w-full">
            Topic overview
          </Link>
        </div>
      </MobileSheet>
      <MobileSheet
        open={settingsOpen}
        title="Reading settings"
        onClose={() => setSettingsOpen(false)}
      >
        <ReaderSettings
          value={{ ...preferences, theme: activeTheme }}
          onChange={changePreferences}
          saved={preferencesSaved}
          signedIn={!!user}
          syncFailed={preferencesSyncFailed}
        />
      </MobileSheet>
      <aside className="hidden lg:sticky lg:top-28 lg:block">
        <Link
          to={`/topics/${topicSlug}`}
          className="link inline-flex min-h-11 items-center gap-2 text-xs"
        >
          <Icon name="chevron" className="h-3 w-3 rotate-180" />
          Back to {lesson.topicName}
        </Link>
        <p className="mt-6 text-[10px] font-semibold uppercase tracking-widest text-muted">
          In this topic
        </p>
        {sequence}
        <LessonSearch markdown={lesson.contentMd} />
        <LessonOutline items={outline} />
        <Link
          className="mt-7 flex items-center gap-2 rounded-xl border border-line bg-surface p-4 text-xs font-medium text-accent"
          to={practiceLink}
        >
          <Icon name="target" className="h-4 w-4 shrink-0" />
          {journey?.practice ? `Practise: ${journey.practice.title}` : "Put it into practice"}
        </Link>
      </aside>
      <article className="reader-article min-w-0 max-w-[68ch]">
        <div className="reader-mobile-tools lg:hidden">
          <button onClick={() => setDetailsOpen(true)} aria-haspopup="dialog">
            <Icon name="book" className="h-4 w-4" />
            Lesson details
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Reading settings"
            aria-haspopup="dialog"
          >
            <span className="font-serif text-base">Aa</span>Reading settings
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span>
            Lesson {lesson.stepNumber} / {lesson.totalSteps}
          </span>
          <span className="h-1 w-1 rounded-full bg-line" />
          <span className="flex items-center gap-1.5">
            <Icon name="clock" className="h-3.5 w-3.5" />
            About {readingMinutes(lesson.contentMd)} min reading
          </span>
          <span className="badge">{stageName(lesson.stage)}{lesson.stage === "DEEP_DIVE" ? " · Optional" : ""}</span>
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
          <div className="flex flex-wrap items-center gap-5">
          <button
            onClick={() => setCardsOpen(true)}
            aria-haspopup="dialog"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent"
          >
            <Icon name="layers" className="h-4 w-4" />
            Swipe cards
          </button>
          {user && (
            <button
              onClick={() => void toggleBookmark()}
              aria-pressed={bookmarked}
              className="inline-flex min-h-11 items-center gap-2 text-sm text-accent"
            >
              <Icon name="check" className={bookmarked ? "h-4 w-4" : "hidden"} />
              {bookmarked ? "Saved for later" : "Save for later"}
            </button>
          )}
          <button
            className="reader-desktop-settings hidden min-h-11 items-center gap-2 text-sm lg:inline-flex"
            onClick={() => setSettingsOpen(true)}
            aria-label="Reading settings"
            aria-haspopup="dialog"
          >
            <span className="font-serif text-lg">Aa</span>Reading settings
          </button>
          </div>
        </div>
        {bookmarkError && (
          <p role="alert" className="mt-4 text-sm text-accent-strong">
            Could not update saved lessons: {bookmarkError}
          </p>
        )}
        {resumeItem && resumeItem.id !== outline[0]?.id && (
          <a
            href={`#${resumeItem.id}`}
            onClick={() => setResumeId("")}
            className="mt-5 flex min-h-11 items-center gap-2 rounded-xl bg-accent-soft p-4 text-sm font-medium text-accent-strong"
          >
            <Icon name="chevron" className="h-4 w-4 shrink-0" />
            <span>Continue from “{resumeItem.text}”</span>
          </a>
        )}
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
          id="lesson-body"
          style={{
            fontSize: preferences.size,
            lineHeight: preferences.spacing === "comfortable" ? 1.85 : 1.65,
            fontFamily:
              preferences.font === "serif"
                ? '"Playfair Display", Georgia, "Times New Roman", serif'
                : "inherit",
          }}
          className="reader-copy prose mt-8 max-w-none leading-[1.85] prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-ink prose-p:text-ink/90 prose-a:text-accent prose-strong:text-ink prose-code:rounded prose-code:bg-track prose-code:px-1 prose-code:font-normal prose-code:text-ink prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-xl prose-li:text-ink/90 prose-blockquote:border-accent prose-blockquote:font-normal prose-blockquote:text-muted prose-table:text-sm [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-white [&_img]:max-w-full"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[[rehypeHighlight, highlightOptions]]}
            components={{
              h2: ({ node, children }) => (
                <h2 id={headingId(node)}>{children}</h2>
              ),
              h3: ({ node, children }) => (
                <h3 id={headingId(node)}>{children}</h3>
              ),
              pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
              table: ({ children }) => (
                <div
                  role="region"
                  aria-label="Scrollable lesson table"
                  tabIndex={0}
                  className="my-6 max-w-full overflow-x-auto"
                >
                  <table>{children}</table>
                </div>
              ),
            }}
          >
            {lesson.contentMd}
          </ReactMarkdown>
        </div>
        <QuickCheck topicSlug={topicSlug} lessonSlug={lesson.slug} />
        <section className="reader-reflection mt-10 rounded-2xl border border-accent/15 bg-accent-soft p-6">
          <p className="text-sm font-medium">Before you move on</p>
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
        {!lesson.next && (
          <section aria-labelledby="whats-next" className="mt-10 rounded-2xl border border-line bg-surface p-6">
            <p className="text-sm font-medium text-muted">
              Last lesson in {lesson.topicName}
            </p>
            <h2 id="whats-next" className="mt-2 text-xl font-semibold">
              What’s next
            </h2>
            <div className="mt-5 flex flex-wrap gap-3">
              {nextTopic ? (
                <Link className="btn" to={`/topics/${nextTopic.topic.slug}`}>
                  Next in {nextTopic.path.name}: {nextTopic.topic.name}
                  <Icon name="arrow" className="h-4 w-4" />
                </Link>
              ) : (
                <Link className="btn" to="/paths">
                  Choose your next path
                  <Icon name="arrow" className="h-4 w-4" />
                </Link>
              )}
              <Link className="outline-btn" to={practiceLink}>
                <Icon name="target" className="h-4 w-4" />
                {journey?.practice ? `Practise: ${journey.practice.title}` : "Practice room"}
              </Link>
              <Link className="btn-quiet" to={`/topics/${topicSlug}`}>
                Topic overview
              </Link>
            </div>
          </section>
        )}
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
                <span>Previous</span>
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
              <Link to="/login" className="btn-quiet px-3 text-xs text-accent">
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
            ) : nextTopic ? (
              <Link
                className="btn-quiet px-3 text-xs"
                to={`/topics/${nextTopic.topic.slug}`}
                aria-label={`Finish topic and go to ${nextTopic.topic.name}`}
              >
                Next topic
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
