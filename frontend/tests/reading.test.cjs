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
