import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { LessonHit, snippetParts } from "../search";

/** Full-text lesson matches for the library search box; waits for a pause in typing before asking. */
export default function LessonResults({ query }: { query: string }) {
  const q = query.trim();
  const [hits, setHits] = useState<LessonHit[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setHits(null);
    setError("");
    if (q.length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      api
        .searchLessons(q)
        .then((data) => {
          if (active) setHits(data);
        })
        .catch(() => {
          if (active) setError("Lesson search is unavailable right now.");
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [q]);
  if (q.length < 2) return null;
  return (
    <section aria-labelledby="lesson-results" className="mt-10">
      <h3 id="lesson-results" className="text-lg font-semibold">
        Lessons
      </h3>
      <p role="status" className="mt-1 text-xs text-muted">
        {error
          ? error
          : hits === null
            ? "Searching lessons…"
            : `${hits.length} ${hits.length === 1 ? "lesson mentions" : "lessons mention"} “${q}”`}
      </p>
      {hits && hits.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
          {hits.map((hit) => (
            <li key={hit.id}>
              <Link
                to={`/topics/${hit.topicSlug}/${hit.slug}`}
                className="group block p-5"
              >
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  {hit.topicName}
                  {hit.exclusive && <span className="badge">Exclusive</span>}
                </span>
                <span className="mt-1 block font-semibold group-hover:text-accent">
                  {hit.title}
                </span>
                {hit.snippet && (
                  <span className="mt-2 block text-sm text-muted">
                    …
                    {snippetParts(hit.snippet).map((part, i) =>
                      part.match ? (
                        <mark key={i} className="rounded bg-accent-soft px-0.5 text-ink">
                          {part.text}
                        </mark>
                      ) : (
                        <span key={i}>{part.text}</span>
                      ),
                    )}
                    …
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
