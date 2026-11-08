import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, can, Topic } from "../api";
import { useAuth } from "../auth";
import Icon from "../components/Icon";
import { LoadState, ProgressBar } from "../components/LearningUI";
import { levelName } from "../learning";

export default function TopicPage() {
  const { topicSlug = "" } = useParams();
  const { user, ready } = useAuth();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [progressError, setProgressError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setTopic(null);
    setError("");
    api
      .topic(topicSlug)
      .then((data) => {
        if (active) setTopic(data);
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, [topicSlug, attempt]);
  useEffect(() => {
    let active = true;
    setDone(new Set());
    setProgressError("");
    if (user && ready)
      api
        .topicProgress(topicSlug)
        .then((data) => {
          if (active) setDone(new Set(data.completedLessonIds));
        })
        .catch(() => {
          if (active)
            setProgressError(
              "Saved progress could not be loaded. Your completed lessons have not been changed.",
            );
        });
    return () => {
      active = false;
    };
  }, [topicSlug, user?.id, ready, attempt]);
  if (error)
    return <LoadState error={error} retry={() => setAttempt((n) => n + 1)} />;
  if (!topic) return <LoadState />;
  const completed = topic.lessons.filter((l) => done.has(l.id)).length;
  const next = topic.lessons.find((l) => !done.has(l.id));
  const mayReadExclusive =
    can(user, "content.exclusive") || can(user, "content.manage");
  const nextLocked = next?.exclusive && !mayReadExclusive;
  return (
    <div className="page-stack">
      <header>
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 text-xs text-muted"
        >
          <Link to="/paths" className="hover:text-accent">
            Learning paths
          </Link>
          <Icon name="chevron" className="h-3 w-3" />
          <Link to={`/#topics`} className="hover:text-accent">
            {topic.categoryName}
          </Link>
        </nav>
        <div className="mt-6 flex flex-wrap gap-2">
          <span className="topic-tag">{levelName(topic.level)}</span>
          <span className="topic-tag">
            {topic.lessons.length} guided lessons
          </span>
        </div>
        <h1 className="mt-4 max-w-3xl text-[clamp(2.3rem,5vw,3.6rem)] font-semibold leading-tight tracking-tightest">
          {topic.name}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">{topic.summary}</p>
      </header>
      <div className="grid items-start gap-7 lg:grid-cols-[1fr_300px]">
        <section className="surface overflow-hidden">
          <div className="border-b border-line p-6">
            <h2 className="text-xl font-semibold">Your lesson sequence</h2>
            <p className="mt-1 text-sm text-muted">
              Work through the ideas in order, or return to a lesson you need.
            </p>
          </div>
          {topic.lessons.length ? (
            <ol className="divide-y divide-line">
              {topic.lessons.map((lesson, i) => {
                const finished = done.has(lesson.id);
                const locked = lesson.exclusive && !mayReadExclusive;
                return (
                  <li key={lesson.id}>
                    <Link
                      to={`/topics/${topicSlug}/${lesson.slug}`}
                      className={`group flex items-center gap-4 p-5 transition-colors hover:bg-canvas sm:p-6 ${next?.id === lesson.id ? "bg-accent-soft/40" : ""}`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${finished ? "border-accent bg-accent text-white" : "border-line bg-canvas text-muted"}`}
                      >
                        {finished ? (
                          <Icon name="check" className="h-4 w-4" />
                        ) : (
                          String(i + 1).padStart(2, "0")
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold group-hover:text-accent sm:text-base">
                          {lesson.title}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                          <span>
                            {finished
                              ? "Complete"
                              : next?.id === lesson.id && user
                                ? "Up next"
                                : "Lesson"}
                          </span>
                          {lesson.exclusive && (
                            <span>
                              {locked
                                ? "Exclusive access required"
                                : "Exclusive lesson"}
                            </span>
                          )}
                        </span>
                      </span>
                      <Icon
                        name="chevron"
                        className="h-4 w-4 shrink-0 text-muted"
                      />
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="p-7 text-muted">
              Lessons haven’t been published for this topic yet.
            </p>
          )}
        </section>
        <aside className="space-y-5 lg:sticky lg:top-28">
          <div className="surface p-6">
            <span className="icon-tile">
              <Icon name="chart" className="h-6 w-6" />
            </span>
            <h2 className="mt-5 text-xl font-semibold">
              One lesson at a time.
            </h2>
            {user ? (
              <>
                <p className="mb-4 mt-3 text-sm text-muted">
                  {progressError ||
                    `${completed} of ${topic.lessons.length} lessons completed.`}
                </p>
                {!progressError && (
                  <ProgressBar
                    done={completed}
                    total={topic.lessons.length}
                    label={`${topic.name} lesson progress`}
                  />
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-muted">
                You can explore the lessons without an account. Sign in to keep
                track of your progress.
              </p>
            )}
            {next && !nextLocked && (
              <Link
                className="btn mt-6 w-full"
                to={`/topics/${topicSlug}/${next.slug}`}
              >
                {completed ? "Continue learning" : "Start learning"}
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
            )}
            {nextLocked && (
              <Link
                className="btn mt-6 w-full"
                to={user ? "/profile" : "/login"}
              >
                {user ? "View exclusive access" : "Sign in to check access"}
              </Link>
            )}
            {!next && topic.lessons.length > 0 && (
              <Link className="btn mt-6 w-full" to="/practice">
                Put it into practice
              </Link>
            )}
            {!user && (
              <Link
                className="link mt-4 inline-flex min-h-11 items-center text-sm"
                to="/login"
              >
                Sign in to save progress
              </Link>
            )}
          </div>
          <div className="rounded-2xl bg-accent-soft p-6">
            <Icon name="target" className="h-6 w-6 text-accent" />
            <h3 className="mt-4 font-semibold">Can you explain the idea?</h3>
            <p className="mt-2 text-sm text-muted">
              After a lesson, close your notes and explain one concept. Use
              practice to find what needs another pass.
            </p>
            <Link
              className="link mt-4 inline-flex min-h-11 items-center gap-2 text-sm"
              to="/practice"
            >
              Open practice room
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
