import test from 'node:test';
import assert from 'node:assert/strict';
import { createPending, authorizationUrl, consumeCallback, checkIdentity, MAX_AGE_MS } from '../site/oauth.js';

const clientId = 'syntheticclientid00000000000000';
const token = 'synthetictoken0000000000000000';
const now = 2000000;
const pending = createPending(clientId, now);
const fragment = state => `#${new URLSearchParams({ access_token: token, token_type: 'bearer', state })}`;
const identity = { client_id: clientId, user_id: '123', scopes: ['user:read:chat'], expires_in: 3600 };

test('authorization uses the exact HTTPS callback, read-only scope and unique state', () => {
  const other = createPending(clientId, now);
  assert.notEqual(pending.state, other.state);
  const url = new URL(authorizationUrl(pending, 'https://example.org/relayroom/auth/callback/'));
  assert.equal(url.origin, 'https://id.twitch.tv');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://example.org/relayroom/auth/callback/');
  assert.equal(url.searchParams.get('scope'), 'user:read:chat');
  assert.equal(url.searchParams.get('response_type'), 'token');
  assert.equal(url.searchParams.get('state'), pending.state);
  assert.equal(url.searchParams.has('client_secret'), false);
});
test('local or ambiguous callbacks and invalid client IDs cannot initiate auth', () => {
  for (const url of ['http://localhost:3000/', 'https://example.org/?next=x', 'https://example.org/#x'])
    assert.throws(() => authorizationUrl(pending, url), /redirect_uri/);
  assert.throws(() => createPending(''), /client_id/);
});
test('matching unexpired callback yields an in-memory token', () => {
  assert.deepEqual(consumeCallback(fragment(pending.state), '', pending, now), { token, clientId });
});
test('missing, future and expired requests fail closed', () => {
  for (const p of [null, { ...pending, createdAt: now + 1 }, { ...pending, createdAt: now - MAX_AGE_MS - 1 }])
    assert.throws(() => consumeCallback(fragment(pending.state), '', p, now), /expired/);
});
test('wrong or duplicate states are rejected without echoing the returned data', () => {
  for (const f of [fragment('wrong'), fragment(pending.state) + '&state=' + pending.state])
    assert.throws(() => consumeCallback(f, '', pending, now), { message: 'state' });
});
test('denied consent is not a success', () => {
  assert.throws(() => consumeCallback('', `?error=access_denied&state=${pending.state}`, pending, now), { message: 'denied' });
});
test('malformed and duplicate tokens fail closed', () => {
  for (const f of [fragment(pending.state).replace(token, 'invalid%20token'), fragment(pending.state) + '&access_token=' + token])
    assert.throws(() => consumeCallback(f, '', pending, now), { message: 'response' });
});
test('a valid identity confirms callback only, never chat or broadcast', () => {
  assert.deepEqual(checkIdentity(identity, clientId), { callbackVerified: true, tokenValidated: true, chatVerified: false, broadcastVerified: false });
});
test('wrong app, extra scope, missing account and expired tokens are rejected', () => {
  for (const data of [{ ...identity, client_id: 'other' }, { ...identity, scopes: ['user:read:chat', 'user:write:chat'] },
    { ...identity, user_id: '' }, { ...identity, expires_in: 0 }, null])
    assert.throws(() => checkIdentity(data, clientId), { message: 'identity' });
});
