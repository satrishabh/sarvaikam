import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SkillMap, { useSkills } from "../components/SkillMap";
import Icon from "../components/Icon";
import { LoadState } from "../components/LearningUI";
import useCatalogue from "../useCatalogue";

export default function SkillsPage() {
  const { categories, error, retry } = useCatalogue();
  const {
    skills,
    signedIn,
    items,
    progressError,
    progressLoading,
    reloadProgress,
  } = useSkills(categories ?? []);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const shown = useMemo(
    () =>
      skills
        .map((subject) => ({
          ...subject,
          topics: subject.topics.filter((topic) => {
            const matches = `${subject.name} ${topic.name}`
              .toLowerCase()
              .includes(query.trim().toLowerCase());
            return (
              matches &&
              (filter === "all" ||
                (filter === "active" &&
                  topic.done > 0 &&
                  topic.done < topic.total) ||
                (filter === "complete" &&
                  topic.total > 0 &&
                  topic.done === topic.total) ||
                (filter === "new" && topic.done === 0))
            );
          }),
        }))
        .filter((subject) => subject.topics.length)
        .map((subject) => ({
          ...subject,
          done: subject.topics.reduce((n, t) => n + t.done, 0),
          total: subject.topics.reduce((n, t) => n + t.total, 0),
        })),
    [skills, query, filter],
  );
  const done = skills.reduce((n, s) => n + s.done, 0);
  const total = skills.reduce((n, s) => n + s.total, 0);
  const active = skills
    .flatMap((s) => s.topics)
    .filter((t) => t.done > 0 && t.done < t.total).length;
  const finished = skills
    .flatMap((s) => s.topics)
    .filter((t) => t.total > 0 && t.done === t.total).length;
  const latest = [...items].sort((a, b) =>
    b.completedAt.localeCompare(a.completedAt),
  )[0];
  return (
    <div className="page-stack">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="eyebrow">YOUR SKILL WORKSPACE</p>
          <h1 className="mt-4 text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-tight tracking-tightest">
            Progress you can
            <br />
            actually use.
          </h1>
          <p className="mt-4 text-lg text-muted">
            Every subject, every topic, and a clear way forward. Pick up where
            you left off or choose something new.
          </p>
        </div>
        <Link className="outline-btn" to="/paths">
          Find a learning path
          <Icon name="arrow" className="h-4 w-4" />
        </Link>
      </header>
      {!signedIn && (
        <div className="surface flex flex-wrap items-center justify-between gap-5 p-6">
          <div>
            <h2 className="font-semibold">
              This is your map of the learning library.
            </h2>
            <p className="mt-1 text-sm text-muted">
              Sign in to see your own completed lessons and topics in progress.
            </p>
          </div>
          <Link className="btn" to="/login">
            Sign in to save progress
          </Link>
        </div>
      )}
      {signedIn && !progressError && !progressLoading && (
        <section
          aria-label="Learning progress summary"
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          {[
            {
              value: done,
              label: "Lessons completed",
              detail: `of ${total} available`,
            },
            {
              value: active,
              label: "Topics in progress",
              detail: "Keep building on them",
            },
            {
              value: finished,
              label: "Topics completed",
              detail: "Ready for another challenge",
            },
            {
              value: latest
                ? new Date(latest.completedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                : "—",
              label: "Last learning activity",
              detail: latest
                ? "A step worth keeping"
                : "Your first step starts here",
            },
          ].map((stat) => (
            <div key={stat.label} className="surface p-5">
              <p className="text-xs font-medium text-muted">{stat.label}</p>
              <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">
                {stat.value}
              </p>
              <p className="mt-2 text-xs text-muted">{stat.detail}</p>
            </div>
          ))}
        </section>
      )}
      {progressError && (
        <div role="alert" className="surface p-6">
          <p className="text-sm text-muted">{progressError}</p>
          <button className="outline-btn mt-4" onClick={reloadProgress}>
            Reload saved progress
          </button>
        </div>
      )}
      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">SUBJECTS & TOPICS</p>
            <h2 className="mt-2 text-2xl font-semibold">
              Your next step is on the map.
            </h2>
            <p className="mt-2 text-sm text-muted">
              Completion tracks lessons you marked done. It is not a skill
              assessment.
            </p>
          </div>
          <label className="relative w-full sm:w-72">
            <span className="sr-only">Search your skill map</span>
            <Icon
              name="search"
              className="absolute left-3.5 top-3 h-5 w-5 text-muted"
            />
            <input
              className="input pl-11"
              type="search"
              placeholder="Find a subject or topic"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        {signedIn && (
          <div
            className="mb-6 flex flex-wrap gap-2"
            aria-label="Filter topics by learning status"
          >
            {[
              ["all", "All topics"],
              ["active", "In progress"],
              ["complete", "Completed"],
              ["new", "Not started"],
            ].map(([value, label]) => (
              <button
                key={value}
                className="filter-chip"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {!categories ? (
          <LoadState error={error} retry={retry} />
        ) : progressLoading ? (
          <LoadState />
        ) : progressError ? (
          <p className="surface p-6 text-sm text-muted">
            Reload your progress to see your map accurately.
          </p>
        ) : shown.length ? (
          <SkillMap skills={shown} signedIn={signedIn} />
        ) : (
          <div className="surface p-10 text-center">
            <Icon name="chart" className="mx-auto h-8 w-8 text-accent" />
            <h3 className="mt-4 text-xl font-semibold">
              {filter === "complete"
                ? "Your first finished topic is ahead."
                : filter === "active"
                  ? "Ready to start a topic?"
                  : "No topics match this view."}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {filter === "active" || filter === "complete"
                ? "Choose a path and mark your first lesson complete to start shaping your map."
                : "Try a different search or show all topics."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                className="outline-btn"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Show all topics
              </button>
              <Link to="/paths" className="btn">
                Choose a path
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
