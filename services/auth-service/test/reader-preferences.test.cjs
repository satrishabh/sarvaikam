const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { AuthService } = require('../dist/auth.service');
const { ReaderPreferencesDto } = require('../dist/profile.dto');

const valid = { size: 20, font: 'serif', theme: 'night', spacing: 'compact' };

test('reader preferences accept only the known settings', async () => {
  assert.equal((await validate(plainToInstance(ReaderPreferencesDto, valid))).length, 0);
  for (const bad of [{ size: 17 }, { size: '18' }, { font: 'mono' }, { theme: 'sepia' }, { spacing: 'loose' }]) {
    const errors = await validate(plainToInstance(ReaderPreferencesDto, { ...valid, ...bad }));
    assert.equal(errors.length, 1, JSON.stringify(bad));
  }
});

test('the slate theme is an accepted reader theme', async () => {
  assert.equal((await validate(plainToInstance(ReaderPreferencesDto, { ...valid, theme: 'slate' }))).length, 0);
});

test('public user returns stored preferences only when every setting is valid', async () => {
  const service = Object.create(AuthService.prototype);
  service.policies = { findOneBy: async () => null };
  const base = { id: 'u', email: 'u@example.com', name: 'U', role: 'USER', businessStatus: 'NONE', organization: '', businessWebsite: '', businessReason: '', reviewNote: '', reviewedAt: null, disabled: false, createdAt: new Date() };
  assert.deepEqual((await service.toPublic({ ...base, readerPreferences: valid })).readerPreferences, valid);
  assert.equal((await service.toPublic({ ...base, readerPreferences: {} })).readerPreferences, null);
  assert.equal((await service.toPublic({ ...base, readerPreferences: { ...valid, size: 99 } })).readerPreferences, null);
});
