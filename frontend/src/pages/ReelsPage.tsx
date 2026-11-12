import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, Category } from "../api";
import { useAuth } from "../auth";
import { LoadState } from "../components/LearningUI";
import { plainText } from "../readingOutline";
import "../reels.css";

import { mockReels } from "../mockReels";

// Sample reels on `npm run dev` (see frontend/.env.development). Remove once real content is wired up.
const USE_MOCK_REELS = import.meta.env.VITE_REELS_MOCK === "true";

export interface Reel {
  key: string;
  href: string;
  topicName: string;
  title: string;
  step: number;
  sentences: string[];
}

const TOPIC_LIMIT = 6;
const REEL_LIMIT = 12;
const SENTENCE_LIMIT = 3;

/** Short, readable sentences from a lesson: headings and code blocks are left out. */
function shortSentences(markdown: string): string[] {
  const text = plainText(
    markdown.replace(/```[\s\S]*?```/g, " ").replace(/^#{1,6} .*$/gm, " "),
  );
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 24)
    .slice(0, SENTENCE_LIMIT)
    .map((sentence) => (sentence.length > 180 ? `${sentence.slice(0, 177)}…` : sentence));
}

/** Newest first: the catalogue assigns higher ids to content that was added later. */
export default function ReelsPage() {
  const { user } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    if (USE_MOCK_REELS) {
      setReels(mockReels);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    (async () => {
      const categories: Category[] = await api.categories();
      const topics = categories
        .flatMap((category) => category.topics)
        .sort((a, b) => b.id - a.id)
        .slice(0, TOPIC_LIMIT);
      const details = await Promise.allSettled(topics.map((topic) => api.topic(topic.slug)));
      const candidates = details
        .flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
        .flatMap((topic) => topic.lessons.map((lesson) => ({ topic, lesson })))
        .filter(({ lesson }) => user || !lesson.exclusive)
        .sort((a, b) => b.lesson.id - a.lesson.id)
        .slice(0, REEL_LIMIT);
      const lessons = await Promise.allSettled(
        candidates.map(({ topic, lesson }) => api.lesson(topic.slug, lesson.slug)),
      );
      const built: Reel[] = [];
      lessons.forEach((result, index) => {
        if (result.status !== "fulfilled") return;
        const sentences = shortSentences(result.value.contentMd);
        if (sentences.length === 0) return;
        const { topic, lesson } = candidates[index];
        built.push({
          key: `${topic.slug}/${lesson.slug}`,
          href: `/topics/${topic.slug}/${lesson.slug}`,
          topicName: topic.name,
          title: lesson.title,
          step: lesson.stepNumber,
          sentences,
        });
      });
      if (active) setReels(built);
    })()
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
      <header className="mb-5">
        <p className="eyebrow">Reels</p>
        <h1 className="mt-2 text-3xl font-semibold">Recent lessons in short bites</h1>
        <p className="mt-2 text-sm text-muted">
          Swipe up for the next one. Swipe right, or use Open lesson, to read the whole lesson.
        </p>
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
        <ReelFeed reels={reels} />
      )}
    </div>
  );
}

function ReelFeed({ reels }: { reels: Reel[] }) {
  return (
    <div className="reels-feed" tabIndex={0} aria-label="Recent lessons">
      {reels.map((reel) => (
        <ReelCard key={reel.key} reel={reel} />
      ))}
    </div>
  );
}

function ReelCard({ reel }: { reel: Reel }) {
  const navigate = useNavigate();
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <article
      className="reel"
      aria-labelledby={`reel-${reel.key.replace(/[^a-z0-9]/gi, "-")}`}
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
        if (dx > 80 && Math.abs(dy) < 60) navigate(reel.href);
      }}
    >
      <div>
        <p className="reel-kicker">
          {reel.topicName} · Step {reel.step}
        </p>
        <h2 id={`reel-${reel.key.replace(/[^a-z0-9]/gi, "-")}`} className="reel-title mt-3">
          {reel.title}
        </h2>
        <ul className="reel-lines mt-6">
          {reel.sentences.map((sentence) => (
            <li key={sentence}>{sentence}</li>
          ))}
        </ul>
      </div>
      <div className="reel-footer">
        <span className="reel-source">
          Source: {reel.topicName} · {reel.title}
        </span>
        <Link className="btn" to={reel.href}>
          Open lesson
        </Link>
      </div>
    </article>
  );
}
