const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { AuthService } = require('../dist/auth.service');
const { LearningPreferencesDto } = require('../dist/profile.dto');

const valid = { path: 'gen-ai', dailyGoal: 3 };

test('learning preferences accept a path slug and a known daily goal', async () => {
  assert.equal((await validate(plainToInstance(LearningPreferencesDto, valid))).length, 0);
  for (const bad of [{ path: 'Gen AI' }, { path: '../x' }, { path: 'a'.repeat(101) }, { dailyGoal: 2 }, { dailyGoal: '3' }]) {
    const errors = await validate(plainToInstance(LearningPreferencesDto, { ...valid, ...bad }));
    assert.ok(errors.length >= 1, JSON.stringify(bad));
  }
});

test('public user returns learning preferences only when they are valid', async () => {
  const service = Object.create(AuthService.prototype);
  service.policies = { findOneBy: async () => null };
  const base = { id: 'u', email: 'u@example.com', name: 'U', role: 'USER', businessStatus: 'NONE', organization: '', businessWebsite: '', businessReason: '', reviewNote: '', reviewedAt: null, disabled: false, createdAt: new Date(), readerPreferences: {} };
  assert.deepEqual((await service.toPublic({ ...base, learningPreferences: valid })).learningPreferences, valid);
  assert.equal((await service.toPublic({ ...base, learningPreferences: {} })).learningPreferences, null);
  assert.equal((await service.toPublic({ ...base, learningPreferences: { path: 'gen-ai', dailyGoal: 7 } })).learningPreferences, null);
  assert.equal((await service.toPublic({ ...base })).learningPreferences, null);
});

test('saving learning preferences stores only the known fields', async () => {
  const saved = [];
  const user = { ...{ id: 'u', email: 'u@example.com', name: 'U', role: 'USER', disabled: false, readerPreferences: {} } };
  const service = Object.create(AuthService.prototype);
  service.policies = { findOneBy: async () => null };
  service.users = { findOneBy: async () => user, save: async (u) => { saved.push({ ...u }); return u; } };
  const result = await service.updateLearningPreferences('u', { ...valid, extra: 'ignored' });
  assert.deepEqual(saved[0].learningPreferences, valid);
  assert.deepEqual(result.learningPreferences, valid);
});
