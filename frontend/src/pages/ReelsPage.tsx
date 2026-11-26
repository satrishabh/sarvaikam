import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, Reel } from "../api";
import { useAuth } from "../auth";
import Icon from "../components/Icon";
import { LoadState } from "../components/LearningUI";
import "../reels.css";

/** The backend returns published reels in update order. */
export default function ReelsPage() {
  const { user } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [index, setIndex] = useState(0);
  const [course, setCourse] = useState("");
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [saveError, setSaveError] = useState("");
  const courses = [...new Map(reels.map((r) => [r.courseSlug, r.courseName])).entries()];
  const shown = course ? reels.filter((r) => r.courseSlug === course) : reels;
  const showFeed = !loading && !error && shown.length > 0;

  // Saved reels are saved lessons: they appear under "Saved for later" with the rest.
  useEffect(() => {
    let active = true;
    setSaved(new Set());
    if (!user) return;
    api.bookmarks()
      .then((items) => {
        if (active) setSaved(new Set(items.map((item) => item.lessonId)));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id]);
  const toggleSave = async (reel: Reel) => {
    if (reel.lessonId == null) return;
    const id = reel.lessonId;
    setSaveError("");
    try {
      if (saved.has(id)) await api.unbookmark(id);
      else await api.bookmark(id, reel.courseSlug);
      setSaved((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Could not save this lesson");
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.reels().then((items) => {
      if (active) { setReels(items); setIndex(0); }
    })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "Could not load reels");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id, attempt]);

  return (
    <div className="reels-page">
      {/* One bar holds the way back and the position, so neither can cover lesson text. */}
      <div className="reels-topbar">
        <Link to="/" className="reels-back">
          <Icon name="chevron" className="h-4 w-4" style={{ transform: "rotate(180deg)" }} />
          Back to home
        </Link>
        {showFeed && (
          <p className="reels-count">
            Lesson {Math.min(index + 1, shown.length)} of {shown.length}
          </p>
        )}
      </div>
      <header className="mb-5">
        <p className="eyebrow">Reels</p>
        <h1 className="mt-2 text-3xl font-semibold">Recent lessons in short bites</h1>
        <p className="mt-2 text-sm text-muted">
          Swipe up for the next one. Swipe right, or use Open lesson, to read the whole lesson.
        </p>
        {courses.length > 1 && (
          <div role="group" aria-label="Show reels from" className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {[["", "All topics"] as [string, string], ...courses].map(([slug, name]) => (
              <button
                key={slug || "all"}
                type="button"
                aria-pressed={course === slug}
                className={`shrink-0 whitespace-nowrap ${course === slug ? "btn" : "outline-btn"} min-h-11 px-4 text-xs`}
                onClick={() => {
                  setCourse(slug);
                  setIndex(0);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        )}
        {saveError && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {saveError}
          </p>
        )}
      </header>

      {loading ? (
        <LoadState />
      ) : error ? (
        <LoadState error={error} retry={() => setAttempt((n) => n + 1)} />
      ) : reels.length === 0 ? (
        <div className="surface p-7">
          <h2 className="text-xl font-semibold">No reels yet</h2>
          <p className="mt-2 text-muted">Recent lessons will appear here once they are published.</p>
        </div>
      ) : (
        <ReelFeed
          key={course}
          reels={shown}
          index={index}
          setIndex={setIndex}
          saved={user ? saved : null}
          onSave={(reel) => void toggleSave(reel)}
        />
      )}
    </div>
  );
}

function ReelFeed({
  reels,
  index,
  setIndex,
  saved,
  onSave,
}: {
  reels: Reel[];
  index: number;
  setIndex: (value: number) => void;
  /** Saved lesson ids; null when signed out (no save button). */
  saved: Set<number> | null;
  onSave: (reel: Reel) => void;
}) {
  const feed = useRef<HTMLDivElement>(null);
  // Keyboard users move one reel at a time with the arrow keys or Page Up and Page Down.
  const goTo = (next: number) => {
    const element = feed.current;
    if (!element) return;
    const target = Math.max(0, Math.min(reels.length - 1, next));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ top: target * element.clientHeight, behavior: reduce ? "auto" : "smooth" });
  };
  return (
    <div
      ref={feed}
      className="reels-feed"
      role="region"
      tabIndex={0}
      aria-label="Recent lessons. Use the arrow keys or swipe up for the next lesson."
      onKeyDown={(event) => {
        const keys: Record<string, number> = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 };
        const step = keys[event.key];
        if (step === undefined) return;
        event.preventDefault();
        goTo(index + step);
      }}
      onScroll={(event) => {
        const { scrollTop, clientHeight } = event.currentTarget;
        if (clientHeight > 0) setIndex(Math.round(scrollTop / clientHeight));
      }}
    >
      {reels.map((reel) => (
        <ReelCard
          key={reel.slug}
          reel={reel}
          saved={saved && reel.lessonId != null ? saved.has(reel.lessonId) : null}
          onSave={() => onSave(reel)}
        />
      ))}
    </div>
  );
}

function ReelCard({ reel, saved, onSave }: { reel: Reel; saved: boolean | null; onSave: () => void }) {
  const navigate = useNavigate();
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <article
      className="reel"
      aria-labelledby={`reel-${reel.slug.replace(/[^a-z0-9]/gi, "-")}`}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        start.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        const origin = start.current;
        start.current = null;
        if (!origin) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - origin.x;
        const dy = touch.clientY - origin.y;
        // A clear swipe to the right opens the full lesson; vertical moves stay with the feed.
        if (dx > 80 && Math.abs(dy) < 60) navigate(`/topics/${reel.courseSlug}/${reel.lessonSlug}`);
      }}
    >
      <div>
        <p className="reel-kicker">
          {reel.courseName} · Step {reel.step}
        </p>
        <h2 id={`reel-${reel.slug.replace(/[^a-z0-9]/gi, "-")}`} className="reel-title mt-3">
          {reel.heading}
        </h2>
        <ul className="reel-lines mt-6">
          {reel.content.split(/\n+/).filter(Boolean).map((sentence) => (
            <li key={sentence}>{sentence}</li>
          ))}
        </ul>
      </div>
      <div className="reel-footer">
        <a className="reel-source" href={reel.sourceUrl} target="_blank" rel="noopener noreferrer">Source: {reel.sourceName}</a>
        <div className="flex flex-wrap gap-2">
          {saved !== null && (
            <button type="button" className="outline-btn" aria-pressed={saved} onClick={onSave}>
              {saved && <Icon name="check" className="h-4 w-4" />}
              {saved ? "Saved" : "Save lesson"}
            </button>
          )}
          <Link className="btn" to={`/topics/${reel.courseSlug}/${reel.lessonSlug}`}>
            Open lesson
          </Link>
        </div>
      </div>
    </article>
  );
}
