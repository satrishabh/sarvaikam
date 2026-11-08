const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  learningPaths,
  pathTopics,
  progressPercent,
  topicState,
} = require("../../.cache/learning-tests/learning.js");
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
for (const file of fs.readdirSync(seedDir).filter((f) => f.endsWith(".json"))) {
  const data = JSON.parse(
    fs.readFileSync(path.join(seedDir, file), "utf8").replace(/^\uFEFF/, ""),
  );
  for (const category of data)
    for (const topic of category.topics)
      published.set(
        topic.slug,
        (published.get(topic.slug) || 0) + topic.lessons.length,
      );
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
