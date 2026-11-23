const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JsonLogger } = require('../dist/json-logger');

function capture(levels = ['error', 'warn', 'log']) {
  const lines = [];
  return { logger: new JsonLogger(levels, line => lines.push(JSON.parse(line))), lines };
}

test('writes Cloud Logging fields with the Nest context', () => {
  const { logger, lines } = capture();
  logger.warn('profile manager slow', 'SessionController');
  assert.equal(lines[0].severity, 'WARNING');
  assert.equal(lines[0].message, 'profile manager slow');
  assert.equal(lines[0].context, 'SessionController');
  assert.ok(Date.parse(lines[0].time));
});

test('keeps the stack trace of errors', () => {
  const { logger, lines } = capture();
  logger.error('refresh failed', 'Error: boom\n    at x', 'SessionController');
  assert.equal(lines[0].severity, 'ERROR');
  assert.match(lines[0].stack_trace, /boom/);
  assert.equal(lines[0].context, 'SessionController');
});

test('respects LOG_LEVEL', () => {
  const { logger, lines } = capture(['error']);
  logger.log('noise');
  logger.debug('more noise');
  assert.equal(lines.length, 0);
});
