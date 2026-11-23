/** A lesson found by full-text search (GET /api/content/search/lessons). */
export interface LessonHit {
  id: number;
  slug: string;
  title: string;
  topicSlug: string;
  topicName: string;
  exclusive: boolean;
  stage: string;
  /** Matched words sit between \u0002 and \u0003; null for exclusive lessons the reader cannot open. */
  snippet: string | null;
}

export interface SnippetPart {
  text: string;
  match: boolean;
}

/** Splits a search snippet into plain and matched parts, so React renders it as text (no HTML). */
export function snippetParts(snippet: string): SnippetPart[] {
  const parts: SnippetPart[] = [];
  for (const [i, chunk] of snippet.split("\u0002").entries()) {
    if (i === 0) {
      if (chunk) parts.push({ text: chunk, match: false });
      continue;
    }
    const stop = chunk.indexOf("\u0003");
    const match = stop < 0 ? chunk : chunk.slice(0, stop);
    const rest = stop < 0 ? "" : chunk.slice(stop + 1);
    if (match) parts.push({ text: match, match: true });
    if (rest) parts.push({ text: rest, match: false });
  }
  return parts;
}
