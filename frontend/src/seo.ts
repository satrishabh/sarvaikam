/**
 * Per-page search and share metadata: the meta description, Open Graph and Twitter tags, and schema.org JSON-LD.
 * index.html holds the site-wide defaults; App resets to them on every route change and a page with its own
 * content (a lesson) overrides them once that content has loaded.
 */

export interface PageMeta {
  title: string;
  description: string;
  url: string;
  structuredData?: object | null;
}

export interface LessonFacts {
  title: string;
  slug: string;
  stepNumber: number;
  contentMd: string;
  topicSlug: string;
  topicName: string;
  topicSummary?: string;
  level?: string;
  minutes?: number;
}

const DESCRIPTION_LIMIT = 155;

/** Plain text of a lesson's opening, cut at a word boundary to fit a search snippet. */
export function describeMarkdown(markdown: string, limit = DESCRIPTION_LIMIT): string {
  const text = markdown
    .replace(/```[\s\S]*?(```|$)/g, " ")
    .split("\n")
    .filter((line) => !/^\s*(#{1,6}\s|>|\||[-*_]{3,}\s*$)/.test(line))
    .map((line) => line.replace(/^\s*([-*+]|\d+\.)\s+/, ""))
    .join(" ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    // Emphasis markers; single underscores stay, since snake_case names are common in lessons.
    .replace(/\*\*|__|~~|\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}

/** schema.org data for a lesson: a LearningResource that is part of its topic's Course, plus breadcrumbs. */
export function lessonStructuredData(lesson: LessonFacts, origin: string, description: string): object {
  const site = origin.replace(/\/+$/, "");
  const topicUrl = `${site}/topics/${lesson.topicSlug}`;
  const url = `${topicUrl}/${lesson.slug}`;
  const provider = { "@type": "Organization", name: "Sarvaikam", url: `${site}/` };
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LearningResource",
        "@id": url,
        name: lesson.title,
        description,
        url,
        inLanguage: "en",
        learningResourceType: "Lesson",
        isAccessibleForFree: true,
        position: lesson.stepNumber,
        ...(lesson.level ? { educationalLevel: lesson.level } : {}),
        ...(lesson.minutes ? { timeRequired: `PT${lesson.minutes}M` } : {}),
        provider,
        isPartOf: {
          "@type": "Course",
          "@id": topicUrl,
          name: lesson.topicName,
          description: lesson.topicSummary || `${lesson.topicName} on Sarvaikam`,
          url: topicUrl,
          provider,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Sarvaikam", item: `${site}/` },
          { "@type": "ListItem", position: 2, name: lesson.topicName, item: topicUrl },
          { "@type": "ListItem", position: 3, name: lesson.title, item: url },
        ],
      },
    ],
  };
}

const SCRIPT_ID = "page-structured-data";

function setMeta(doc: Document, attribute: "name" | "property", key: string, content: string) {
  let element = doc.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = doc.createElement("meta");
    element.setAttribute(attribute, key);
    doc.head.appendChild(element);
  }
  element.content = content;
}

/** Writes the page's description, share tags and structured data into the document head. */
export function applyPageMeta(meta: PageMeta, doc: Document = document) {
  setMeta(doc, "name", "description", meta.description);
  setMeta(doc, "property", "og:title", meta.title);
  setMeta(doc, "property", "og:description", meta.description);
  setMeta(doc, "property", "og:url", meta.url);
  setMeta(doc, "name", "twitter:title", meta.title);
  setMeta(doc, "name", "twitter:description", meta.description);
  doc.getElementById(SCRIPT_ID)?.remove();
  if (meta.structuredData) {
    const script = doc.createElement("script");
    script.type = "application/ld+json";
    script.id = SCRIPT_ID;
    // "</" cannot appear inside the JSON, so lesson text can never close the script element.
    script.textContent = JSON.stringify(meta.structuredData).replace(/</g, "\\u003c");
    doc.head.appendChild(script);
  }
}

let siteDescription: string | null = null;

/** The description index.html ships with, read once before any page replaces it. */
export function defaultDescription(doc: Document = document): string {
  if (siteDescription === null)
    siteDescription = doc.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "";
  return siteDescription;
}
