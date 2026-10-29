import { createPending, authorizationUrl, PENDING_KEY } from './oauth.js';

const callback = new URL('auth/callback/', location.href).href;
const redirectField = document.querySelector('#redirect');
redirectField.value = callback;
const status = document.querySelector('#status');
document.querySelector('#copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(callback); status.textContent = 'Callback URL copied.'; }
  catch { redirectField.focus(); redirectField.select(); status.textContent = 'Select and copy the callback URL above.'; }
});
document.querySelector('form').addEventListener('submit', event => {
  event.preventDefault();
  const clientId = document.querySelector('#client-id').value.trim();
  try {
    const pending = createPending(clientId);
    const url = authorizationUrl(pending, callback);
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    location.assign(url);
  } catch (error) {
    status.textContent = error.message === 'client_id'
      ? 'Enter the public Client ID from your registered Twitch app. Do not enter a client secret.'
      : location.protocol !== 'https:'
        ? 'Open the HTTPS site to start a Twitch connection check. Local previews do not start authorization.'
        : 'This tab could not save the temporary connection state. Allow session storage, then try again.';
  }
});
