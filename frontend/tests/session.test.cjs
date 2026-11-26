const { test } = require("node:test");
const assert = require("node:assert/strict");
const { claimDevice, clearPersonalData, isPersonalKey, pendingLogout } = require("../../.cache/learning-tests/sessionSync.js");

function memoryStore(entries = {}) {
  const data = new Map(Object.entries(entries));
  return {
    get length() { return data.size; },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    keys: () => [...data.keys()].sort(),
  };
}

test("sign-out removes one learner's activity but keeps device display settings", () => {
  const store = memoryStore({
    "sarvaikam.practice.v1.u1.q1": "my notes",
    "sarvaikam.reader.resume.v1": "[]",
    "sarvaikam.dailyGoal": "3",
    "sarvaikam.token": "legacy",
    "sarvaikam.owner": "u1",
    "sarvaikam.reader.v1": "{\"size\":\"L\"}",
    "unrelated.app": "x",
  });
  clearPersonalData(store);
  assert.deepEqual(store.keys(), ["sarvaikam.reader.v1", "unrelated.app"]);
});

test("a different account signing in on a shared browser never sees the previous learner's notes", () => {
  const store = memoryStore({});
  claimDevice("u1", store);
  store.setItem("sarvaikam.practice.v1.u1.q1", "u1 notes");
  claimDevice("u1", store);
  assert.equal(store.getItem("sarvaikam.practice.v1.u1.q1"), "u1 notes");
  claimDevice("u2", store);
  assert.equal(store.getItem("sarvaikam.practice.v1.u1.q1"), null);
  assert.equal(store.getItem("sarvaikam.owner"), "u2");
});

test("an unfinished server sign-out is remembered for the next load", () => {
  const store = memoryStore({});
  assert.equal(pendingLogout.get(store), false);
  pendingLogout.set(store);
  assert.equal(pendingLogout.get(store), true);
  pendingLogout.clear(store);
  assert.equal(pendingLogout.get(store), false);
  assert.equal(isPersonalKey("sarvaikam.reader.v1"), false);
});
