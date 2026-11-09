import { useId, useState } from "react";
import { searchLesson } from "../readingOutline";

export default function LessonSearch({ markdown }: { markdown: string }) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const matches = trimmed.length >= 2 ? searchLesson(markdown, trimmed) : [];
  return (
    <section aria-label="Search this lesson" className="mt-7">
      <label htmlFor={inputId} className="text-[10px] font-semibold uppercase tracking-widest text-muted">
        Search this lesson
      </label>
      <input
        id={inputId}
        type="search"
        className="input mt-3 text-sm"
        value={query}
        placeholder="Find a word or phrase"
        onChange={(event) => setQuery(event.target.value)}
      />
      {trimmed.length >= 2 && (
        <p role="status" className="mt-2 text-xs text-muted">
          {matches.length === 0
            ? "No matches in this lesson."
            : `${matches.length}${matches.length === 30 ? "+" : ""} ${matches.length === 1 ? "match" : "matches"}`}
        </p>
      )}
      {matches.length > 0 && (
        <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-xs">
          {matches.map((match, index) => (
            <li key={`${match.sectionId}-${index}`}>
              <a href={`#${match.sectionId}`} className="block rounded-lg p-2.5 hover:bg-track">
                <span className="font-semibold text-accent-strong">{match.sectionText}</span>
                <span className="mt-1 block text-muted">{match.snippet}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
