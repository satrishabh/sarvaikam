const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  outlineFromMarkdown,
  readResumePoint,
  saveResumePoint,
  slugify,
} = require("../../.cache/learning-tests/readingOutline.js");

function fakeStorage(impl) {
  Object.defineProperty(globalThis, "localStorage", {
    value: impl,
    configurable: true,
    writable: true,
  });
}

test("outline lists h2 and h3 headings with unique ids and source lines", () => {
  const markdown = [
    "# Title",
    "",
    "## Why it matters",
    "",
    "### Details",
    "",
    "## Why it matters",
    "",
    "## Java 21 & Records",
  ].join("\n");
  assert.deepEqual(
    outlineFromMarkdown(markdown).map((item) => [item.id, item.level, item.line]),
    [
      ["why-it-matters", 2, 3],
      ["details", 3, 5],
      ["why-it-matters-2", 2, 7],
      ["java-21-records", 2, 9],
    ],
  );
});

test("outline ignores headings inside fenced code", () => {
  const markdown = ["## Real", "```", "## Not a heading", "```", "~~~", "## Still code", "~~~", "## Also real"].join("\n");
  assert.deepEqual(
    outlineFromMarkdown(markdown).map((item) => item.text),
    ["Real", "Also real"],
  );
});

test("heading text keeps readable words from inline markdown and links", () => {
  const [item] = outlineFromMarkdown("## Use `Optional` with [streams](https://example.com)");
  assert.equal(item.text, "Use Optional with streams");
  assert.equal(item.id, "use-optional-with-streams");
});

test("slugify removes accents and punctuation and never returns an empty id", () => {
  assert.equal(slugify("Café — naïve"), "cafe-naive");
  assert.equal(slugify("!!!"), "section");
});

test("resume point keeps the latest section per lesson", () => {
  const store = new Map();
  fakeStorage({
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
  });
  saveResumePoint({ lessonId: 1, id: "a" });
  saveResumePoint({ lessonId: 2, id: "b" });
  saveResumePoint({ lessonId: 1, id: "c" });
  assert.deepEqual(readResumePoint(1), { lessonId: 1, id: "c" });
  assert.equal(readResumePoint(2).id, "b");
  assert.equal(readResumePoint(3), null);
});

test("resume is optional when browser storage is unavailable or corrupt", () => {
  fakeStorage({
    getItem() {
      throw new Error("storage blocked");
    },
    setItem() {
      throw new Error("storage blocked");
    },
  });
  assert.doesNotThrow(() => saveResumePoint({ lessonId: 1, id: "a" }));
  assert.equal(readResumePoint(1), null);

  fakeStorage({ getItem: () => "{not json", setItem() {} });
  assert.equal(readResumePoint(1), null);
});

test("reader settings from storage or the account are used only when every value is known", () => {
  const { normalizeReaderPreferences } = require("../../.cache/learning-tests/readerPreferences.js");
  const valid = { size: 20, font: "serif", theme: "night", spacing: "compact" };
  assert.deepEqual(normalizeReaderPreferences(valid), valid);
  assert.equal(normalizeReaderPreferences(null), null);
  assert.equal(normalizeReaderPreferences({}), null);
  assert.equal(normalizeReaderPreferences({ ...valid, size: "20" }), null);
  assert.equal(normalizeReaderPreferences({ ...valid, theme: "sepia" }), null);
});

test("lesson search reports each match with its section and ignores very short queries", () => {
  const { searchLesson } = require("../../.cache/learning-tests/readingOutline.js");
  const markdown = [
    "Intro about Records.",
    "## Core idea",
    "Records are immutable.",
    "```java",
    "record Point(int x) {}",
    "```",
    "## Summary",
    "Nothing relevant here.",
  ].join("\n");
  assert.deepEqual(
    searchLesson(markdown, "RECORD").map((m) => [m.sectionId, m.sectionText]),
    [
      ["lesson-body", "Introduction"],
      ["core-idea", "Core idea"],
      ["core-idea", "Core idea"],
    ],
  );
  assert.equal(searchLesson(markdown, "r").length, 0);
  assert.equal(searchLesson(markdown, "immutable")[0].snippet, "Records are immutable.");
  assert.equal(searchLesson(markdown, "record", 1).length, 1);
});

// Ratchet: lessons without section headings get no table of contents. The count may fall, never rise.
test("seeded lessons do not add new unstructured content", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const { outlineFromMarkdown } = require("../../.cache/learning-tests/readingOutline.js");
  const seed = path.join(__dirname, "../../services/content-service/src/main/resources/seed");
  const UNSTRUCTURED_BASELINE = 131;
  let lessons = 0;
  const unstructured = [];
  for (const file of fs.readdirSync(seed).filter((name) => name.endsWith(".json"))) {
    for (const category of JSON.parse(fs.readFileSync(path.join(seed, file), "utf8"))) {
      for (const topic of category.topics ?? []) {
        for (const lesson of topic.lessons ?? []) {
          lessons++;
          if (outlineFromMarkdown(lesson.content ?? "").length < 2) unstructured.push(`${topic.slug}/${lesson.slug}`);
        }
      }
    }
  }
  assert.ok(lessons > 0, "no seeded lessons were found");
  assert.ok(
    unstructured.length <= UNSTRUCTURED_BASELINE,
    `${unstructured.length} lessons lack section headings (baseline ${UNSTRUCTURED_BASELINE}); add ## headings to new lessons`,
  );
});

test("lesson cards split at second-level headings and keep the introduction", () => {
  const { lessonCards } = require("../../.cache/learning-tests/readingOutline.js");
  const cards = lessonCards(["Intro text.", "## First", "Body one.", "### Sub", "More.", "## Second", "Body two.", "```", "## not a card", "```"].join("\n"));
  assert.deepEqual(
    cards.map((card) => [card.id, card.title]),
    [["lesson-body", "Introduction"], ["first", "First"], ["second", "Second"]],
  );
  assert.equal(cards[1].markdown, "Body one.\n\n### Sub\nMore.".replace("\n\n", "\n"));
  assert.ok(cards[2].markdown.includes("## not a card"));
});

test("lessons without enough second-level headings split at third-level headings", () => {
  const { lessonCards } = require("../../.cache/learning-tests/readingOutline.js");
  const cards = lessonCards(["### Alpha", "a", "### Beta", "b"].join("\n"));
  assert.deepEqual(cards.map((card) => card.title), ["Alpha", "Beta"]);
});
