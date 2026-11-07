const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ProfileClient } = require('../dist/profile-client.service');

function setup(t, handler) {
  const previous = global.fetch;
  process.env.PROFILE_API_CLIENT_SECRET = 'unit-test-api-secret';
  process.env.PROFILE_REGISTRATION_CLIENT_SECRET = 'unit-test-registration-secret';
  const calls = [];
  global.fetch = async (url, options) => { calls.push({ url, options }); return handler(url, options); };
  t.after(() => { global.fetch = previous; delete process.env.PROFILE_API_CLIENT_SECRET; delete process.env.PROFILE_REGISTRATION_CLIENT_SECRET; });
  return { client: new ProfileClient(), calls };
}
test('login uses the confidential API client and does not expose provider errors', async t => {
  const { client, calls } = setup(t, () => new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'private provider details' }), { status: 400 }));
  await assert.rejects(client.login('person@example.com', 'password'), error => !error.message.includes('private provider details'));
  const form = new URLSearchParams(calls[0].options.body);
  assert.equal(form.get('grant_type'), 'password');
  assert.equal(form.get('client_id'), 'sarvaikam-learn-api');
  assert.equal(form.get('client_secret'), 'unit-test-api-secret');
});
test('registration creates only an unverified profile and requests an email action', async t => {
  const id = '11111111-1111-4111-8111-111111111111';
  const { client, calls } = setup(t, url => url.endsWith('/token') ? new Response(JSON.stringify({ access_token: 'admin-token' })) : url.endsWith('/users') ? new Response(null, { status: 201, headers: { location: 'https://profile.sarvaikam.com/admin/realms/sarvaikam/users/' + id } }) : new Response(null, { status: 204 }));
  await client.register({ name: 'Jordan Lee', email: 'jordan@example.com', password: 'long-passphrase-123' });
  const user = JSON.parse(calls[1].options.body);
  assert.equal(user.emailVerified, false); assert.equal(user.enabled, true);
  assert.deepEqual(user.requiredActions, ['VERIFY_EMAIL']); assert.equal(user.realmRoles, undefined);
  assert.equal(user.credentials[0].temporary, false);
  assert.ok(calls[2].url.includes('/execute-actions-email'));
  assert.deepEqual(JSON.parse(calls[2].options.body), ['VERIFY_EMAIL']);
  const adminForm = new URLSearchParams(calls[0].options.body);
  assert.equal(adminForm.get('client_id'), 'sarvaikam-learn-registration');
  assert.equal(adminForm.get('client_secret'), 'unit-test-registration-secret');
});
test('duplicate registrations do not disclose account existence', async t => {
  const { client, calls } = setup(t, url => url.endsWith('/token') ? new Response(JSON.stringify({ access_token: 'admin-token' })) : new Response(null, { status: 409 }));
  assert.equal(await client.register({ name: 'Jordan Lee', email: 'jordan@example.com', password: 'long-passphrase-123' }), undefined);
  assert.equal(calls.length, 2);
});
test('refresh stays server-to-server and logout revokes the profile refresh session', async t => {
  const { client, calls } = setup(t, url => url.endsWith('/token') ? new Response(JSON.stringify({ access_token: 'new-access', refresh_token: 'new-refresh' })) : new Response(null, { status: 204 }));
  await client.refresh('old-refresh'); await client.logout('new-refresh');
  assert.equal(new URLSearchParams(calls[0].options.body).get('grant_type'), 'refresh_token');
  assert.equal(new URLSearchParams(calls[1].options.body).get('refresh_token'), 'new-refresh');
});
test('missing accounts do not trigger email or reveal whether an account exists', async t => {
  const { client, calls } = setup(t, url => url.endsWith('/token') ? new Response(JSON.stringify({ access_token: 'admin-token' })) : new Response('[]'));
  assert.equal(await client.emailAction('missing@example.com', 'VERIFY_EMAIL'), undefined);
  assert.equal(calls.length, 2);
});
