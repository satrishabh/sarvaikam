const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  applyPageMeta,
  describeMarkdown,
  lessonStructuredData,
} = require("../../.cache/learning-tests/seo.js");

test("a lesson's description is its opening prose as plain text", () => {
  const markdown = [
    "# Vector databases",
    "",
    "A **vector database** stores [embeddings](https://example.com/e) for `semantic search`.",
    "",
    "```python",
    "index.add(vectors)",
    "```",
    "",
    "- Fast nearest-neighbour lookups",
    "- Works with user_id filters - and more",
    "> A note",
  ].join("\n");
  assert.equal(
    describeMarkdown(markdown),
    "A vector database stores embeddings for semantic search. Fast nearest-neighbour lookups Works with user_id filters - and more",
  );
});

test("long descriptions are cut at a word boundary within the snippet limit", () => {
  const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
  const description = describeMarkdown(words);
  assert.ok(description.length <= 155, description.length);
  assert.match(description, /word\d+…$/);
  assert.equal(describeMarkdown("Short and sweet."), "Short and sweet.");
  assert.equal(describeMarkdown("```\nonly code\n```"), "");
});

test("structured data describes the lesson as part of its topic's course", () => {
  const data = lessonStructuredData(
    {
      title: "Vector databases",
      slug: "rag",
      stepNumber: 2,
      contentMd: "",
      topicSlug: "gen-ai",
      topicName: "Generative AI",
      topicSummary: "Build with LLMs.",
      level: "Intermediate",
      minutes: 6,
    },
    "https://learn.example/",
    "Stores embeddings.",
  );
  const [lesson, breadcrumbs] = data["@graph"];
  assert.equal(lesson["@type"], "LearningResource");
  assert.equal(lesson.url, "https://learn.example/topics/gen-ai/rag");
  assert.equal(lesson.timeRequired, "PT6M");
  assert.equal(lesson.educationalLevel, "Intermediate");
  assert.equal(lesson.isPartOf["@type"], "Course");
  assert.equal(lesson.isPartOf.url, "https://learn.example/topics/gen-ai");
  assert.equal(lesson.isPartOf.description, "Build with LLMs.");
  assert.deepEqual(
    breadcrumbs.itemListElement.map((item) => item.item),
    ["https://learn.example/", "https://learn.example/topics/gen-ai", "https://learn.example/topics/gen-ai/rag"],
  );
});

/** Just enough of a Document for applyPageMeta. */
function fakeDocument() {
  const children = [];
  const make = (tag) => {
    const element = {
      tagName: tag,
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; },
      remove() { children.splice(children.indexOf(element), 1); },
    };
    return element;
  };
  const matches = (element, selector) => {
    const [, attribute, value] = selector.match(/^meta\[(\w+)="([^"]+)"\]$/);
    return element.tagName === "meta" && element.attributes[attribute] === value;
  };
  return {
    children,
    head: {
      querySelector: (selector) => children.find((element) => matches(element, selector)) ?? null,
      appendChild: (element) => children.push(element),
    },
    createElement: make,
    getElementById: (id) => children.find((element) => element.id === id) ?? null,
  };
}

test("page metadata is written once per page and the JSON cannot close its script element", () => {
  const doc = fakeDocument();
  const meta = {
    title: "RAG | Sarvaikam",
    description: "Retrieval.",
    url: "https://learn.example/topics/gen-ai/rag",
    structuredData: { name: "</script><script>alert(1)</script>" },
  };
  applyPageMeta(meta, doc);
  applyPageMeta(meta, doc);
  const get = (attribute, key) => doc.children.find((e) => e.attributes[attribute] === key)?.content;
  assert.equal(get("name", "description"), "Retrieval.");
  assert.equal(get("property", "og:url"), meta.url);
  assert.equal(get("name", "twitter:title"), meta.title);
  const scripts = doc.children.filter((e) => e.tagName === "script");
  assert.equal(scripts.length, 1, "replaced, not duplicated");
  assert.doesNotMatch(scripts[0].textContent, /<\//);
  assert.equal(JSON.parse(scripts[0].textContent).name, meta.structuredData.name);

  applyPageMeta({ ...meta, structuredData: null }, doc);
  assert.equal(doc.children.filter((e) => e.tagName === "script").length, 0, "pages without data drop it");
  assert.equal(doc.children.filter((e) => e.attributes.name === "description").length, 1);
});
