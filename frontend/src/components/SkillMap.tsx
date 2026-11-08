import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, Category, ProgressItem } from "../api";
import { useAuth } from "../auth";
import { weekCountByTopic } from "../engagement";
import { progressPercent, topicState } from "../learning";
import { ProgressBar } from "./LearningUI";
import Icon from "./Icon";

export interface TopicSkill {
  slug: string;
  name: string;
  level: string;
  done: number;
  total: number;
}
export interface CategorySkill {
  slug: string;
  name: string;
  icon: string;
  done: number;
  total: number;
  week: number;
  topics: TopicSkill[];
}
export function useSkills(categories: Category[]) {
  const { user, ready } = useAuth();
  const [items, setItems] = useState<ProgressItem[]>([]);
  const [progressError, setProgressError] = useState("");
  const [progressLoading, setProgressLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const reloadProgress = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    setItems([]);
    setProgressError("");
    if (!user || !ready) {
      setProgressLoading(false);
      return;
    }
    setProgressLoading(true);
    api
      .myProgress()
      .then((data) => {
        if (active)
          setItems([...new Map(data.map((p) => [p.lessonId, p])).values()]);
      })
      .catch(() => {
        if (active)
          setProgressError(
            "Your saved progress could not be loaded. Your completed lessons have not been changed.",
          );
      })
      .finally(() => {
        if (active) setProgressLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id, ready, attempt]);
  const skills = useMemo<CategorySkill[]>(() => {
    const week = weekCountByTopic(items);
    const counts = new Map<string, number>();
    items.forEach((p) =>
      counts.set(p.topicSlug, (counts.get(p.topicSlug) ?? 0) + 1),
    );
    return categories.map((c) => {
      const topics = c.topics.map((t) => ({
        slug: t.slug,
        name: t.name,
        level: t.level,
        total: t.lessonCount,
        done: Math.min(counts.get(t.slug) ?? 0, t.lessonCount),
      }));
      return {
        slug: c.slug,
        name: c.name,
        icon: c.icon,
        topics,
        done: topics.reduce((n, t) => n + t.done, 0),
        total: topics.reduce((n, t) => n + t.total, 0),
        week: c.topics.reduce((n, t) => n + (week.get(t.slug) ?? 0), 0),
      };
    });
  }, [categories, items]);
  const lastActivity = items.reduce<string | null>(
    (latest, p) => (!latest || p.completedAt > latest ? p.completedAt : latest),
    null,
  );
  return {
    skills,
    signedIn: !!user,
    lastActivity,
    items,
    user,
    progressError,
    progressLoading: progressLoading || !ready,
    reloadProgress,
  };
}
function SubjectCard({
  subject,
  signedIn,
}: {
  subject: CategorySkill;
  signedIn: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? subject.topics : subject.topics.slice(0, 2);
  const finished = subject.topics.filter(
    (t) => t.total > 0 && t.done === t.total,
  ).length;
  const percent = progressPercent(subject.done, subject.total);
  const icon = /cloud|devops|infra/i.test(subject.slug)
    ? "cloud"
    : /data|database/i.test(subject.slug)
      ? "layers"
      : /interview/i.test(subject.slug)
        ? "target"
        : "code";
  return (
    <section
      className="surface min-w-0 p-5 sm:p-6"
      aria-label={`${subject.name} skills`}
    >
      <div className="flex items-center gap-3">
        <span className="icon-tile h-10 w-10">
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug">
            {subject.name}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {subject.topics.length} topics · {subject.total} lessons
          </p>
        </div>
        {signedIn && (
          <span className="text-xl font-semibold tabular-nums">{percent}%</span>
        )}
      </div>
      {signedIn ? (
        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>
              {subject.done} of {subject.total} lessons complete
            </span>
            <span>{finished} topics finished</span>
          </div>
          <ProgressBar
            done={subject.done}
            total={subject.total}
            label={`${subject.name} completion`}
          />
        </div>
      ) : (
        <p className="mt-5 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
          Explore a topic below. Sign in to save your progress.
        </p>
      )}
      <ul id={`subject-${subject.slug}`} className="mt-4 divide-y divide-line">
        {shown.map((t) => (
          <li key={t.slug}>
            <Link
              to={`/topics/${t.slug}`}
              className="group flex min-h-[72px] items-center gap-3 py-3"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${t.done === t.total && t.total > 0 ? "border-accent bg-accent text-white" : t.done > 0 ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"}`}
              >
                {t.done === t.total && t.total > 0 ? (
                  <Icon name="check" className="h-3.5 w-3.5" />
                ) : (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full bg-current"
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium group-hover:text-accent">
                  {t.name}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {signedIn
                    ? `${topicState(t.done, t.total)} · ${t.done}/${t.total} lessons`
                    : `${t.total} lessons`}
                </span>
              </span>
              <Icon name="chevron" className="h-4 w-4 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      {subject.topics.length > 2 && (
        <button
          className="mt-2 min-h-11 w-full rounded-lg border border-line text-xs font-semibold hover:bg-canvas"
          aria-expanded={expanded}
          aria-controls={`subject-${subject.slug}`}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? "Show fewer topics"
            : `Show all ${subject.topics.length} topics`}
        </button>
      )}
    </section>
  );
}
export default function SkillMap({
  skills,
  signedIn,
  limit,
}: {
  skills: CategorySkill[];
  signedIn: boolean;
  limit?: number;
}) {
  const shown = limit
    ? [...skills]
        .sort(
          (a, b) =>
            Number(b.done > 0 && b.done < b.total) -
              Number(a.done > 0 && a.done < a.total) || b.done - a.done,
        )
        .slice(0, limit)
    : skills;
  if (!shown.length)
    return (
      <div className="surface p-8">
        <h3 className="text-lg font-semibold">
          Your map starts with one topic.
        </h3>
        <p className="mt-2 text-muted">
          Choose a learning path to find a starting point.
        </p>
        <Link className="btn mt-5" to="/paths">
          Explore learning paths
        </Link>
      </div>
    );
  return (
    <div
      className={`grid items-start gap-5 md:grid-cols-2 ${limit ? "xl:grid-cols-3" : ""}`}
    >
      {shown.map((subject) => (
        <SubjectCard key={subject.slug} subject={subject} signedIn={signedIn} />
      ))}
    </div>
  );
}
