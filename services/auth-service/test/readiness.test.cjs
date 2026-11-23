const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ServiceUnavailableException } = require('@nestjs/common');
const { AuthController } = require('../dist/auth.controller');

const controller = db => new AuthController({}, {}, db);

test('ready when the database answers', async () => {
  assert.deepEqual(await controller({ query: async () => [{ '?column?': 1 }] }).ready(), { status: 'UP' });
});

test('not ready when the database errors', async () => {
  await assert.rejects(controller({ query: async () => { throw new Error('connection refused'); } }).ready(), ServiceUnavailableException);
});

test('liveness ignores the database', () => {
  assert.deepEqual(controller({ query: async () => { throw new Error('down'); } }).health(), { status: 'UP' });
});
