export const SCOPE = 'user:read:chat';
export const PENDING_KEY = 'relayroom.oauth.pending.v1';
export const MAX_AGE_MS = 10 * 60 * 1000;

export function createPending(clientId, now = Date.now(), random = crypto) {
  if (!/^[a-zA-Z0-9]{20,64}$/.test(clientId)) throw new Error('client_id');
  const bytes = random.getRandomValues(new Uint8Array(32));
  return { clientId, state: Array.from(bytes, n => n.toString(16).padStart(2, '0')).join(''), createdAt: now };
}

export function authorizationUrl(pending, redirectUri) {
  const redirect = new URL(redirectUri);
  if (redirect.protocol !== 'https:' || redirect.hash || redirect.search) throw new Error('redirect_uri');
  const url = new URL('https://id.twitch.tv/oauth2/authorize');
  url.search = new URLSearchParams({ client_id: pending.clientId, redirect_uri: redirect.href,
    response_type: 'token', scope: SCOPE, state: pending.state, force_verify: 'true' });
  return url.href;
}

// Only the caller's memory receives the token. Never include it in an error or result receipt.
export function consumeCallback(hash, search, pending, now = Date.now()) {
  if (!pending || !/^[a-zA-Z0-9]{20,64}$/.test(pending.clientId ?? '') ||
      !/^[a-f0-9]{64}$/.test(pending.state ?? '') || !Number.isFinite(pending.createdAt) ||
      now < pending.createdAt || now - pending.createdAt > MAX_AGE_MS) throw new Error('expired');
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  const query = new URLSearchParams(search);
  const params = query.has('error') ? query : fragment;
  if (params.getAll('state').length !== 1 || params.get('state') !== pending.state) throw new Error('state');
  if (params.has('error')) throw new Error('denied');
  if (fragment.getAll('access_token').length !== 1 || !/^[a-zA-Z0-9]{20,200}$/.test(fragment.get('access_token') ?? '') ||
      fragment.get('token_type') !== 'bearer') throw new Error('response');
  return { token: fragment.get('access_token'), clientId: pending.clientId };
}

export function checkIdentity(data, clientId) {
  if (!data || data.client_id !== clientId || !/^\d+$/.test(data.user_id ?? '') ||
      !Array.isArray(data.scopes) || data.scopes.length !== 1 || data.scopes[0] !== SCOPE ||
      !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw new Error('identity');
  return { callbackVerified: true, tokenValidated: true, chatVerified: false, broadcastVerified: false };
}
