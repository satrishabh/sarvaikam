import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Category, TopicSummary } from "../api";
import {
  LearningPath,
  levelName,
  pathTopics,
  progressPercent,
  topicState,
} from "../learning";
import Icon from "./Icon";

export function SectionHeading({
  kicker,
  title,
  description,
  action,
}: {
  kicker?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {kicker && <p className="eyebrow">{kicker}</p>}
        <h2 className="mt-2 text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-tight tracking-tightest">
          {title}
        </h2>
        {description && (
          <p className="mt-2 max-w-2xl text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
export function LoadState({
  error,
  retry,
}: {
  error?: string;
  retry?: () => void;
}) {
  return error ? (
    <div role="alert" className="surface p-7">
      <h2 className="text-xl font-semibold">
        The learning library couldn’t load.
      </h2>
      <p className="mt-2 text-muted">
        Your progress has not been changed. Try loading the library again.
      </p>
      {retry && (
        <button className="btn mt-5" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  ) : (
    <div
      aria-label="Loading the learning library"
      role="status"
      className="grid gap-5 md:grid-cols-3"
    >
      {[0, 1, 2].map((n) => (
        <div key={n} className="skeleton h-56" />
      ))}
    </div>
  );
}
export function ProgressBar({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label: string;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.max(1, total)}
      aria-valuenow={Math.min(done, total)}
      aria-valuetext={`${done} of ${total} lessons complete`}
      className="progress-track"
    >
      <div
        className={done === total && total > 0 ? "bg-accent" : "bg-ink"}
        style={{ width: `${progressPercent(done, total)}%` }}
      />
    </div>
  );
}
export function PathCard({
  path,
  categories,
}: {
  path: LearningPath;
  categories: Category[];
}) {
  const topics = pathTopics(path, categories);
  return (
    <Link
      className={`path-card tone-${path.tone} group`}
      to={`/paths#${path.slug}`}
    >
      <div className="flex items-center justify-between">
        <span className="icon-tile">
          <Icon name={path.icon} className="h-6 w-6" />
        </span>
        <Icon
          name="arrow"
          className="h-5 w-5 text-muted transition-transform group-hover:translate-x-1"
        />
      </div>
      <p className="mt-7 text-xs font-semibold uppercase tracking-widest text-muted">
        CAREER PATH
      </p>
      <h3 className="mt-2 text-2xl font-semibold">{path.name}</h3>
      <p className="mt-2 text-sm text-muted">{path.subtitle}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {topics.slice(0, 3).map((t) => (
          <span className="topic-tag" key={t.slug}>
            {t.name}
          </span>
        ))}
      </div>
      <p className="mt-6 border-t border-line pt-4 text-sm font-medium">
        {topics.length} topics <span className="mx-2 text-line">/</span>{" "}
        {topics.reduce((n, t) => n + t.lessonCount, 0)} lessons
      </p>
    </Link>
  );
}
export function TopicCard({
  topic,
  done = 0,
  signedIn = false,
}: {
  topic: TopicSummary;
  done?: number;
  signedIn?: boolean;
}) {
  return (
    <Link to={`/topics/${topic.slug}`} className="topic-card group">
      <div className="flex items-center justify-between gap-3">
        <span className="topic-tag">{levelName(topic.level)}</span>
        <Icon
          name="arrow"
          className="h-4 w-4 text-muted transition-transform group-hover:translate-x-1"
        />
      </div>
      <h3 className="mt-5 text-lg font-semibold leading-snug group-hover:text-accent">
        {topic.name}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
        {topic.summary}
      </p>
      <div className="mt-6 flex items-center justify-between gap-2 border-t border-line pt-4 text-xs font-medium">
        <span>{topic.lessonCount} lessons</span>
        <span className={done ? "text-accent" : "text-muted"}>
          {signedIn ? topicState(done, topic.lessonCount) : "Explore topic"}
        </span>
      </div>
      {signedIn && (
        <div className="mt-3">
          <ProgressBar
            done={done}
            total={topic.lessonCount}
            label={`${topic.name} progress`}
          />
        </div>
      )}
    </Link>
  );
}
