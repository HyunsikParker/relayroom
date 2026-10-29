import { consumeCallback, checkIdentity, PENDING_KEY } from './oauth.js';

// Remove credentials from the visible URL before reading storage or making any request.
let fragment = location.hash;
let query = location.search;
history.replaceState(null, '', location.pathname);
const heading = document.querySelector('h1');
const status = document.querySelector('#status');
const errors = {
  expired: 'There is no recent connection request in this tab. Return to setup and start a new check.',
  state: 'This callback does not match the request from this tab. Return to setup and try again.',
  denied: 'Twitch access was not authorized. No connection was established.',
  response: 'Twitch did not return a supported authorization response. Return to setup and try again.',
  identity: 'The token did not match this app and its read-only chat permission. No connection was kept.',
  network: 'Token validation did not complete. No connection was kept. Return to setup and try again.'
};

async function verify() {
  let token;
  try {
    let pending;
    try {
      const saved = sessionStorage.getItem(PENDING_KEY);
      sessionStorage.removeItem(PENDING_KEY);
      pending = saved ? JSON.parse(saved) : null;
    } catch { throw new Error('expired'); }
    const result = consumeCallback(fragment, query, pending);
    fragment = ''; query = '';
    token = result.token;
    result.token = undefined;
    status.textContent = 'Checking the returned token with Twitch…';
    let response;
    try {
      response = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${token}` }, credentials: 'omit', cache: 'no-store',
        redirect: 'error', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(10000)
      });
    } catch { throw new Error('network'); }
    if (!response.ok) throw new Error('network');
    let data;
    try { data = await response.json(); } catch { throw new Error('network'); }
    checkIdentity(data, result.clientId);
    heading.textContent = 'Callback verified.';
    status.textContent = 'Twitch validated the returned token for this app. This check has ended; the token is not retained by Relayroom.';
    document.querySelector('#result').hidden = false;
  } catch (error) {
    heading.textContent = 'Connection check incomplete.';
    status.textContent = errors[error.message] ?? errors.network;
  } finally { token = undefined; fragment = ''; query = ''; }
}
verify();
