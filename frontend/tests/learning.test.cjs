const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  learningPaths,
  pathTopics,
  progressPercent,
  topicState,
  groupedLessons,
  orderedLessons,
} = require("../../.cache/learning-tests/learning.js");

test("levels preserve lessons and sequence while keeping deep dives optional", () => {
  const lessons = [
    { id: 1, slug: "internals", stage: "DEEP_DIVE", stepNumber: 1 },
    { id: 2, slug: "locks", stage: "ADVANCED", stepNumber: 2 },
    { id: 3, slug: "setup", stage: "STARTER", stepNumber: 3 },
    { id: 4, slug: "legacy", stepNumber: 4 },
  ];
  assert.deepEqual(orderedLessons(lessons).map(l => l.slug), ["setup", "legacy", "locks", "internals"]);
  const groups = groupedLessons(lessons);
  assert.equal(groups.length, 4);
  assert.equal(groups[1].lessons.length, 0);
  assert.match(groups[3].description, /Optional/);
  assert.equal(new Set(groups.flatMap(g => g.lessons.map(l => l.id))).size, lessons.length);
  assert.equal(lessons[0].slug, "internals");
});
const {
  practiceQuestions,
} = require("../../.cache/learning-tests/practice.js");

test("a learning path preserves its sequence while omitting unpublished and empty topics", () => {
  const path = learningPaths[0];
  const java = { slug: "java", lessonCount: 4 };
  const sql = { slug: "databases-sql", lessonCount: 3 };
  const empty = { slug: "spring-boot", lessonCount: 0 };
  const result = pathTopics(path, [{ topics: [sql, empty, java] }]);
  assert.deepEqual(
    result.map((t) => t.slug),
    ["java", "databases-sql"],
  );
  assert.equal(
    result.reduce((n, t) => n + t.lessonCount, 0),
    7,
  );
});

test("an empty topic is not presented as complete and progress stays bounded", () => {
  assert.equal(topicState(0, 0), "No lessons yet");
  assert.equal(progressPercent(0, 0), 0);
  assert.equal(progressPercent(20, 4), 100);
  assert.equal(topicState(0, 4), "Not started");
  assert.equal(topicState(2, 4), "In progress");
  assert.equal(topicState(4, 4), "Complete");
});

const seedDir = path.resolve(
  __dirname,
  "../../services/content-service/src/main/resources/seed",
);
const published = new Map();
const lessonKeys = new Set();
for (const file of fs.readdirSync(seedDir).filter((f) => f.endsWith(".json"))) {
  const data = JSON.parse(
    fs.readFileSync(path.join(seedDir, file), "utf8").replace(/^\uFEFF/, ""),
  );
  for (const category of data)
    for (const topic of category.topics) {
      for (const lesson of topic.lessons) {
        const key = `${topic.slug}/${lesson.slug}`;
        assert.ok(!lessonKeys.has(key), `Duplicate lesson: ${key}`);
        lessonKeys.add(key);
        assert.ok(["STARTER", "INTERMEDIATE", "ADVANCED", "DEEP_DIVE"].includes(lesson.stage), `Missing or invalid level: ${key}`);
      }
      published.set(
        topic.slug,
        (published.get(topic.slug) || 0) + topic.lessons.length,
      );
    }
}

test("career paths link to real lesson-bearing catalogue topics without duplicates", () => {
  for (const path of learningPaths) {
    assert.equal(new Set(path.topics).size, path.topics.length, path.slug);
    for (const slug of path.topics)
      assert.ok(
        published.get(slug) > 0,
        `${path.slug} links to missing content ${slug}`,
      );
  }
});

test("practice question links, timer suggestions, hints, and review data are complete", () => {
  assert.equal(
    new Set(practiceQuestions.map((q) => q.id)).size,
    practiceQuestions.length,
  );
  const supported = new Set([
    "Coding",
    "System design",
    "SQL",
    "Behavioral",
    "Cloud & DevOps",
  ]);
  for (const q of practiceQuestions) {
    assert.ok(
      published.get(q.topic) > 0,
      `${q.id}: missing related lesson topic`,
    );
    assert.ok(supported.has(q.category), q.id);
    assert.ok([5, 10, 15, 20, 30].includes(q.minutes), q.id);
    assert.ok(
      q.prompt.length > 50 &&
        q.constraints.length >= 2 &&
        q.hints.length >= 1 &&
        q.criteria.length >= 3 &&
        q.outline.length >= 3,
      q.id,
    );
  }
});

const {
  readReaderPreferences,
  saveReaderPreferences,
  defaultReaderPreferences,
} = require("../../.cache/learning-tests/readerPreferences.js");
function withStorage(t, implementation) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: implementation,
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  });
}
test("reader settings safely recover from malformed or unsupported saved values", (t) => {
  withStorage(t, { getItem: () => "{broken" });
  assert.deepEqual(readReaderPreferences(), defaultReaderPreferences);
  globalThis.localStorage.getItem = () =>
    JSON.stringify({
      size: 200,
      font: "unknown",
      theme: "unknown",
      spacing: "unknown",
    });
  assert.deepEqual(readReaderPreferences(), defaultReaderPreferences);
});
test("reader settings round-trip without changing lesson or account data", (t) => {
  const stored = new Map();
  withStorage(t, {
    getItem: (key) => stored.get(key),
    setItem: (key, value) => stored.set(key, value),
  });
  const settings = {
    size: 22,
    font: "serif",
    theme: "night",
    spacing: "compact",
  };
  assert.equal(saveReaderPreferences(settings), true);
  assert.deepEqual(readReaderPreferences(), settings);
  assert.deepEqual([...stored.keys()], ["sarvaikam.reader.v1"]);
});
test("blocked browser storage does not break the reader", (t) => {
  withStorage(t, {
    getItem: () => {
      throw new Error("Blocked");
    },
    setItem: () => {
      throw new Error("Blocked");
    },
  });
  assert.deepEqual(readReaderPreferences(), defaultReaderPreferences);
  assert.equal(saveReaderPreferences(defaultReaderPreferences), false);
});
