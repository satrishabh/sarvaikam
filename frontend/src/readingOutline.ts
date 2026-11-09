export interface OutlineItem {
  id: string;
  text: string;
  level: 2 | 3;
  line: number;
}

export interface ResumePoint {
  lessonId: number;
  id: string;
}

const HEADING = /^(#{2,3})\s+(.+?)\s*#*\s*$/;
const FENCE = /^\s*(`{3,}|~{3,})/;
const RESUME_KEY = "sarvaikam.reader.resume.v1";
const RESUME_LIMIT = 50;

export function plainText(markdown: string) {
  return markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(text: string) {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-") || "section"
  );
}

export function outlineFromMarkdown(markdown: string): OutlineItem[] {
  const seen = new Map<string, number>();
  const items: OutlineItem[] = [];
  let fence = "";
  markdown.split("\n").forEach((source, index) => {
    const fenced = source.match(FENCE);
    if (fenced) {
      if (!fence) fence = fenced[1];
      else if (source.trim().startsWith(fence)) fence = "";
      return;
    }
    if (fence) return;
    const heading = source.match(HEADING);
    if (!heading) return;
    const text = plainText(heading[2]);
    const base = slugify(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    items.push({
      id: count === 0 ? base : `${base}-${count + 1}`,
      text,
      level: heading[1].length === 2 ? 2 : 3,
      line: index + 1,
    });
  });
  return items;
}

function readResumeEntries(): ResumePoint[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(RESUME_KEY) ?? "[]");
    return Array.isArray(raw)
      ? raw.filter(
          (item): item is ResumePoint =>
            typeof item?.lessonId === "number" && typeof item?.id === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export function readResumePoint(lessonId: number): ResumePoint | null {
  return readResumeEntries().find((point) => point.lessonId === lessonId) ?? null;
}

export function saveResumePoint(point: ResumePoint) {
  try {
    const entries = readResumeEntries().filter(
      (item) => item.lessonId !== point.lessonId,
    );
    entries.push(point);
    localStorage.setItem(RESUME_KEY, JSON.stringify(entries.slice(-RESUME_LIMIT)));
  } catch {
    // Resume is a convenience; the lesson reads the same without it.
  }
}

export interface LessonMatch {
  sectionId: string;
  sectionText: string;
  snippet: string;
}

// Finds lines of lesson text that contain the query and reports the section each one sits in.
// Matches are case-insensitive; the intro before the first heading links to the top of the lesson.
export function searchLesson(markdown: string, query: string, limit = 30): LessonMatch[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  const outline = outlineFromMarkdown(markdown);
  const matches: LessonMatch[] = [];
  markdown.split("\n").forEach((source, index) => {
    if (matches.length >= limit || HEADING.test(source)) return;
    const text = plainText(source);
    const at = text.toLowerCase().indexOf(needle);
    if (at < 0) return;
    const section = outline.filter((item) => item.line <= index + 1).pop();
    const start = Math.max(0, at - 60);
    const end = Math.min(text.length, at + needle.length + 60);
    matches.push({
      sectionId: section?.id ?? "lesson-body",
      sectionText: section?.text ?? "Introduction",
      snippet: `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`,
    });
  });
  return matches;
}
