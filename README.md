# Relayroom connection check

A small HTTPS callback and browser-based connection check for the Codex × TwitchCon Hackathon. This is preparation for a Twitch-connected experience. It is **not a completed interactive project or contest submission**.

## What it does

1. Gives the app owner a callback URL to register with Twitch.
2. Starts Twitch’s documented implicit grant flow after the owner enters their public Client ID and chooses **Continue to Twitch**.
3. Checks the returned state, validates the token with Twitch, confirms the app and read-only chat permission, then discards the token.

It does not read chat, send messages, broadcast, keep an OAuth session or prove that broadcasting is available in any particular region. The deployed page and synthetic tests do not establish that a live Twitch connection has passed.

## Setup

The intended GitHub Pages site is `https://hyunsikparker.github.io/relayroom/`. Confirm that it loads before using it. Its callback path is `auth/callback/`, including the trailing slash.

The account owner must register their own Twitch application, complete any required account verification and review applicable developer terms. Add the complete HTTPS callback URL from the page as an OAuth Redirect URL. For this implicit grant flow, use a **Confidential** client: Twitch currently limits **Public** clients to device-code authorization. The browser check does not use or ask for a client secret.

Open the HTTPS site in the same tab where the connection check will run. Enter the application’s public Client ID. Review Twitch’s permission screen yourself. A successful callback confirms only the returned authorization and token validation, not chat or streaming functionality.

## Data handling

The page requests only `user:read:chat`. Tokens stay in browser memory for the single validation request; they are not written to browser storage, displayed, logged or sent to the site host. The URL fragment is removed when the callback script runs. Pending request state, timestamp and public Client ID use tab-scoped session storage and are removed when the callback is processed. There is no application backend, analytics, third-party JavaScript or remote font.

See the [privacy notice](site/privacy.html). GitHub Pages and Twitch process their own service requests. Closing this page does not revoke permission previously granted in Twitch.

## Local checks

Requires Node.js 22 or later. No runtime dependencies or build step.

```sh
npm test
python3 -m http.server 42868 --bind 127.0.0.1 --directory site
```

Local HTTP preview deliberately cannot start OAuth. All automated tests use synthetic data and must not authorize a real account. The `site/` directory is the complete static deployment.

For browser regression checks, run `npm ci`, install Chrome and Playwright's Firefox/WebKit runtimes (`npx playwright install firefox webkit`), then run `node test/browser.mjs`. These tests intercept every Twitch request with synthetic responses. They cover return-state errors, refusal, token validation, reloads and narrow/wide layouts in all three engines.

## Codex use

OpenAI Codex authored the connection UI, callback logic and synthetic tests. Primary build session: `01a0f2f9-b4c3-7e81-b761-f9e47042dcce`. Work on this repository began October 30, 2026 KST, within the contest’s submission period. No live Twitch result is claimed.

## Official references

- [Registering a Twitch app](https://dev.twitch.tv/docs/authentication/register-app/)
- [OAuth flows and client types](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/)
- [Token validation](https://dev.twitch.tv/docs/authentication/validate-tokens/)
- [Hackathon rules](https://twitchcon-codex.devpost.com/rules)
