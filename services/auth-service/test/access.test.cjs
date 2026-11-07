const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { AuthService } = require('../dist/auth.service');
const { SessionController } = require('../dist/session.controller');
const { BusinessApplicationDto, SignUpDto, PolicyDto } = require('../dist/profile.dto');

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const admin = { id: 'admin', role: 'ADMIN', email: 'admin@example.com', disabled: false, businessStatus: 'NONE' };
const candidate = { id: 'candidate', role: 'USER', email: 'person@example.com', disabled: false, businessStatus: 'NONE' };
function fixture(extra = []) {
  const data = new Map([admin, candidate, ...extra].map(u => [u.id, { ...u }]));
  const audits = [];
  const policies = new Map();
  const manager = {
    transaction: async fn => fn(manager), query: async () => [],
    findOne: async (entity, opts) => data.get(opts.where.id),
    findOneBy: async (entity, opts) => data.get(opts.id),
    countBy: async () => [...data.values()].filter(u => u.role === 'ADMIN' && !u.disabled).length,
    save: async (entity, value) => {
      if (!value) { data.set(entity.id, entity); return entity; }
      if (entity.name === 'AccessAudit') audits.push(value);
      if (entity.name === 'RolePolicy') policies.set(value.role, value);
      return value;
    },
  };
  const users = {
    manager, findOneBy: async opts => opts.oidcSub ? [...data.values()].find(u => u.oidcSub === opts.oidcSub) : data.get(opts.id),
    existsBy: async opts => [...data.values()].some(u => u.email === opts.email),
    create: fields => ({ id: 'new', businessStatus: 'NONE', disabled: false, ...fields }),
    save: async user => { data.set(user.id, user); return user; },
    update: async (where, values) => { Object.assign(data.get(where.id), values); },
  };
  const service = new AuthService(users, { signAsync: async () => 'session-token' }, { findOneBy: async opts => policies.get(opts.role), manager }, { find: async () => audits });
  service.profileKeys = { getSigningKey: (kid, callback) => callback(null, { getPublicKey: () => publicKey.export({ type: 'spki', format: 'pem' }) }) };
  return { service, data, audits, policies, users };
}
function token(claims = {}) {
  return jwt.sign({ sub: 'oidc-new', azp: 'sarvaikam-learn-api', email: 'new@example.com', email_verified: true, ...claims }, privateKey,
    { algorithm: 'RS256', keyid: 'test', issuer: 'https://profile.sarvaikam.com/realms/sarvaikam', expiresIn: 300 });
}
for (const [description, claims] of [
  ['unverified email', { email_verified: false }],
  ['truthy string verification', { email_verified: 'true' }],
  ['invalid email', { email: 'bad-email' }],
  ['wrong client', { azp: 'another-app' }],
  ['empty subject', { sub: '' }],
]) test(`rejects ${description}`, async () => { await assert.rejects(fixture().service.exchangeProfileToken(token(claims))); });
test('normal registration creates an active user with no approval', async () => {
  const result = await fixture().service.exchangeProfileToken(token());
  assert.equal(result.user.role, 'USER'); assert.equal(result.user.businessStatus, 'NONE');
  assert.deepEqual(result.user.permissions, ['assets.download']); assert.equal(result.token, 'session-token');
});
test('business realm claims cannot bypass an application review', async () => {
  const result = await fixture().service.exchangeProfileToken(token({ realm_access: { roles: ['business'] } }));
  assert.equal(result.user.role, 'USER');
});
test('approved app role survives subsequent profile sign-in', async () => {
  const f = fixture([{ ...candidate, oidcSub: 'oidc-business', role: 'BUSINESS', businessStatus: 'APPROVED' }]);
  const result = await f.service.exchangeProfileToken(token({ sub: 'oidc-business', email: candidate.email }));
  assert.equal(result.user.role, 'BUSINESS'); assert.ok(result.user.permissions.includes('content.exclusive'));
});
test('a profile role cannot override an app suspension', async () => {
  const f = fixture([{ ...candidate, oidcSub: 'oidc-disabled', disabled: true }]);
  await assert.rejects(f.service.exchangeProfileToken(token({ sub: 'oidc-disabled', email: candidate.email, realm_access: { roles: ['content-admin'] } })));
  await assert.rejects(f.service.me(candidate.id));
});
test('identity refresh cannot overwrite a concurrent suspension', async () => {
  const f = fixture([{ ...candidate, oidcSub: 'oidc-race' }]);
  f.users.update = async (where, values) => {
    assert.deepEqual(Object.keys(values).sort(), ['email', 'name']);
    Object.assign(f.data.get(where.id), values, { disabled: true });
  };
  await assert.rejects(f.service.exchangeProfileToken(token({ sub: 'oidc-race', email: candidate.email })));
  assert.equal(f.data.get(candidate.id).disabled, true);
});
test('business application stays USER until approval and writes an audit record', async () => {
  const f = fixture();
  const result = await f.service.applyForBusiness(candidate.id, { organization: 'Acme', website: 'https://example.com', reason: 'Train our engineering team' });
  assert.equal(result.role, 'USER'); assert.equal(result.businessStatus, 'PENDING'); assert.equal(f.audits[0].action, 'business.applied');
  await assert.rejects(f.service.applyForBusiness(candidate.id, {}));
  const approved = await f.service.reviewBusiness(admin.id, candidate.id, { decision: 'APPROVED', note: 'Organization verified' });
  assert.equal(approved.role, 'BUSINESS'); assert.equal(approved.businessStatus, 'APPROVED');
  await assert.rejects(f.service.reviewBusiness(admin.id, candidate.id, { decision: 'REJECTED', note: 'Duplicate review' }));
});
test('decline preserves ordinary access and permits reapplication', async () => {
  const f = fixture([{ ...candidate, businessStatus: 'PENDING' }]);
  const declined = await f.service.reviewBusiness(admin.id, candidate.id, { decision: 'REJECTED', note: 'Please provide a public website' });
  assert.equal(declined.role, 'USER'); assert.equal(declined.businessStatus, 'REJECTED');
  const reapplied = await f.service.applyForBusiness(candidate.id, { organization: 'Acme', website: 'https://example.com', reason: 'Train our engineering team' });
  assert.equal(reapplied.businessStatus, 'PENDING');
});
test('normal users cannot approve themselves or grant permissions', async () => {
  const f = fixture();
  await assert.rejects(f.service.reviewBusiness(candidate.id, candidate.id, { decision: 'APPROVED', note: 'Self approved' }));
  await assert.rejects(f.service.updatePolicy(candidate.id, 'USER', ['content.manage']));
  await assert.rejects(f.service.updateAccess(candidate.id, candidate.id, { role: 'ADMIN' }));
});
test('business role cannot be assigned before business approval', async () => {
  await assert.rejects(fixture().service.updateAccess(admin.id, candidate.id, { role: 'BUSINESS' }));
});
test('admin cannot lock out their own administrator account', async () => {
  await assert.rejects(fixture().service.updateAccess(admin.id, admin.id, { disabled: true }));
  await assert.rejects(fixture().service.updateAccess(admin.id, admin.id, { role: 'USER' }));
});
test('policy changes affect existing users; admin policy stays fixed', async () => {
  const f = fixture();
  await f.service.updatePolicy(admin.id, 'USER', ['content.exclusive']);
  assert.deepEqual((await f.service.me(candidate.id)).permissions, ['content.exclusive']);
  await assert.rejects(f.service.updatePolicy(admin.id, 'ADMIN', []));
  assert.ok((await f.service.me(admin.id)).permissions.includes('candidates.view'));
});
test('DTO validation rejects malformed email, weak password, and invalid website', async () => {
  assert.ok((await validate(plainToInstance(SignUpDto, { name: 'A', email: 'invalid', password: 'short' }))).length >= 3);
  assert.equal((await validate(plainToInstance(SignUpDto, { name: 'Jane Doe', email: ' JANE@EXAMPLE.COM ', password: 'long-passphrase-123' }))).length, 0);
  assert.ok((await validate(plainToInstance(BusinessApplicationDto, { organization: 'A', website: 'javascript:alert(1)', reason: 'short' }))).length >= 3);
  assert.ok((await validate(plainToInstance(PolicyDto, { permissions: ['admin.superuser'] }))).length);
});
test('session actions reject form CSRF and rate-limit login attempts', () => {
  const c = new SessionController({}, {});
  assert.throws(() => c.check({ get: () => undefined }));
  const req = { get: () => 'web', ip: '127.0.0.1', path: '/login' };
  for (let i = 0; i < 12; i++) c.check(req);
  assert.throws(() => c.check(req));
});
test('PostgreSQL entity metadata has valid types without connecting to a database', async () => {
  const { DataSource } = require('typeorm');
  const { User } = require('../dist/user.entity');
  const { RolePolicy, AccessAudit } = require('../dist/access.entity');
  const source = new DataSource({ type: 'postgres', entities: [User, RolePolicy, AccessAudit] });
  await source.buildMetadatas();
  assert.equal(source.entityMetadatas.length, 3);
});
