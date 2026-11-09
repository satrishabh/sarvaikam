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
