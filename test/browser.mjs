import { chromium, firefox, webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
import { createPending, PENDING_KEY } from '../site/oauth.js';

const root = fileURLToPath(new URL('../site/', import.meta.url));
const server = createServer(async (req, res) => {
  try {
    let path = new URL(req.url, 'http://local.test').pathname;
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(root, '.' + path);
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) throw new Error('path');
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(file)];
    res.writeHead(200, { 'Content-Type': mime ?? 'text/plain' }); res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const clientId = 'syntheticclientid00000000000000';
const token = 'synthetictoken0000000000000000';
let count = 0;
try {
  for (const [name, engine] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
    const browser = await engine.launch(name === 'chromium' ? { channel: 'chrome' } : {});
    try {
      const page = await browser.newPage();
      let validationCalls = 0;
      let syntheticResponse = { client_id: clientId, user_id: '123', scopes: ['user:read:chat'], expires_in: 3600 };
      await page.route('**/*', async route => {
        const url = route.request().url();
        if (url.startsWith(base + '/')) return route.continue();
        if (url === 'https://id.twitch.tv/oauth2/validate') {
          validationCalls++;
          assert.equal(route.request().headers().authorization, `OAuth ${token}`);
          return route.fulfill({ status: 200, contentType: 'application/json',
            headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(syntheticResponse) });
        }
        throw new Error('Unexpected external request: ' + new URL(url).origin);
      });
      await page.goto(base);
      assert.equal(await page.locator('#redirect').inputValue(), base + '/auth/callback/');
      await page.locator('#client-id').fill(clientId);
      await page.locator('#client-id').press('Enter');
      await page.getByText('Local previews do not start authorization.', { exact: false }).waitFor();
      assert.equal(validationCalls, 0); count++;
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 850 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/${name}-${width}.png`, fullPage: true });
      }
      await page.goto(base + '/auth/callback/#access_token=' + token);
      await page.getByRole('heading', { name: 'Connection check incomplete.' }).waitFor();
      assert.equal(new URL(page.url()).hash, ''); assert.equal(validationCalls, 0); count++;
      async function callback(kind = 'success') {
        await page.goto(base);
        const pending = createPending(clientId);
        await page.evaluate(([key, value]) => sessionStorage.setItem(key, JSON.stringify(value)), [PENDING_KEY, pending]);
        const tail = kind === 'denied' ? `?error=access_denied&state=${pending.state}` :
          `#access_token=${token}&token_type=bearer&state=${kind === 'wrong' ? 'wrong' : pending.state}`;
        await page.goto(base + '/auth/callback/' + tail);
      }
      await callback('wrong');
      await page.getByText('This callback does not match', { exact: false }).waitFor();
      assert.equal(validationCalls, 0); count++;
      await callback('denied');
      await page.getByText('Twitch access was not authorized.', { exact: false }).waitFor();
      assert.equal(validationCalls, 0); count++;
      await callback();
      await page.getByRole('heading', { name: 'Callback verified.' }).waitFor();
      assert.equal(validationCalls, 1);
      assert.equal(new URL(page.url()).hash, '');
      assert.equal(await page.evaluate(() => sessionStorage.length), 0);
      assert.equal(await page.evaluate(() => localStorage.length), 0);
      assert.equal((await page.locator('body').innerText()).includes(token), false);
      assert.equal((await page.locator('body').innerText()).includes('have not been verified'), true); count++;
      await page.reload();
      await page.getByRole('heading', { name: 'Connection check incomplete.' }).waitFor();
      assert.equal(validationCalls, 1); count++;
      syntheticResponse = { ...syntheticResponse, client_id: 'wrongapp' };
      await callback();
      await page.getByText('The token did not match this app', { exact: false }).waitFor();
      assert.equal(validationCalls, 2); count++;
      console.log(`${name}: 7 scenarios passed; 390px and 1280px checked; all Twitch requests intercepted with synthetic fixtures.`);
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
console.log(`${count} browser scenarios passed. No live Twitch authorization or API call was performed.`);
