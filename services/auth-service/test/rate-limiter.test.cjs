const test = require('node:test');
const assert = require('node:assert/strict');
const { RateLimiter, LocalRateLimiter, WINDOW_MS } = require('../dist/rate-limiter');

/** Stands in for Postgres: applies the same upsert rules to a Map, and records what was sent. */
function fakeDb() {
  const rows = new Map();
  const calls = [];
  return {
    rows, calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('DELETE')) return [];
      const [keys] = params;
      assert.equal(new Set(keys).size, keys.length, 'a bucket may appear only once per statement');
      return keys.map((key) => {
        const count = (rows.get(key) ?? 0) + 1;
        rows.set(key, count);
        return { key, count };
      });
    },
  };
}

test('counts are shared through the database: two replicas allow the limit once, not twice', async () => {
  const db = fakeDb();
  const a = new RateLimiter(db);
  const b = new RateLimiter(db);
  const rule = [['login:acct:10.0.0.1:abc', 10]];
  for (let i = 0; i < 5; i++) assert.equal(await a.hit(rule), true);
  for (let i = 0; i < 5; i++) assert.equal(await b.hit(rule), true);
  assert.equal(await a.hit(rule), false);
  assert.equal(await b.hit(rule), false);
});

test('only digests of bucket names reach the database, never an IP or email', async () => {
  const db = fakeDb();
  await new RateLimiter(db).hit([['login:ip:203.0.113.9', 300], ['login:acct:203.0.113.9:jane@example.com', 10]]);
  const sent = JSON.stringify(db.calls.map((c) => c.params));
  assert.doesNotMatch(sent, /203\.0\.113\.9|example\.com/);
  for (const key of db.calls[0].params[0]) assert.match(key, /^[0-9a-f]{64}$/);
  assert.equal(db.calls[0].params[1], WINDOW_MS / 1000);
});

test('the same bucket twice in one request is sent once, with the stricter limit', async () => {
  const db = fakeDb();
  const limiter = new RateLimiter(db);
  assert.equal(await limiter.hit([['x', 5], ['x', 1]]), true);
  assert.equal(await limiter.hit([['x', 5], ['x', 1]]), false);
});

test('a database failure falls back to this instance\'s counts instead of allowing everything', async () => {
  const limiter = new RateLimiter({ query: async () => { throw new Error('connection refused'); } });
  const warnings = [];
  limiter.log = { warn: (m) => warnings.push(m) };
  for (let i = 0; i < 3; i++) assert.equal(await limiter.hit([['k', 3]]), true);
  assert.equal(await limiter.hit([['k', 3]]), false);
  assert.equal(warnings.length, 1, 'warned once, not on every request');
});

test('expired buckets are swept at most every ten minutes', async () => {
  const db = fakeDb();
  const limiter = new RateLimiter(db);
  for (let i = 0; i < 20; i++) await limiter.hit([[`k${i}`, 10]]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(db.calls.filter((c) => c.sql.startsWith('DELETE')).length, 1);
});

test('local counts reset after the window and never count a rejected attempt', () => {
  const local = new LocalRateLimiter();
  let now = 1_800_000_000_000;
  local.now = () => now;
  assert.equal(local.hit([['a', 1], ['b', 2]]), true);
  assert.equal(local.hit([['a', 1], ['b', 2]]), false);
  assert.equal(local.hit([['b', 2]]), true, 'the rejected attempt did not use a slot of b');
  now += WINDOW_MS + 1;
  assert.equal(local.hit([['a', 1]]), true);
});

test('no rules means nothing to count', async () => {
  const db = fakeDb();
  assert.equal(await new RateLimiter(db).hit([]), true);
  assert.equal(db.calls.length, 0);
});
