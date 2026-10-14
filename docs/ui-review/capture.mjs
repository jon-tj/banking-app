// Captures screenshots of every screen in /demo for the UI review (WBS 2.6).
// Run from the repository root:  node docs/ui-review/capture.mjs
//
// Needs Node 22+ (built-in WebSocket) and Google Chrome. No npm packages.
//
// How it works:
//   1. Starts ONE headless Chrome with a throwaway profile in the OS temp
//      folder (never your normal Chrome profile) and talks to it over the
//      DevTools protocol.
//   2. Opens demo/index.html once. The demo seeds its data on load; that
//      seed is kept, and restored before every screen so all screenshots
//      show the same data. demo/ itself is never copied or modified.
//   3. For each screen: sets the viewport (desktop 1280x800, phone 390x844),
//      logs in as the given user by setting the demo's `state.me`, sets the
//      route, waits for fonts, measures the page height, then grows the
//      viewport to that height and captures it.
//   4. Closes Chrome and deletes the profile, also on errors or timeout.
//
// Account numbers are random and dates are relative to today, so numbers in
// the images differ between runs.

import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT = join(HERE, 'screenshots');
const PAGE = pathToFileURL(join(ROOT, 'demo/index.html')).href;
const TIMEOUT_MS = 120_000;

const VIEWPORTS = {
  desktop: { width: 1280, height: 800, mobile: false },
  mobile: { width: 390, height: 844, mobile: true },
};

// name, user to log in as (null = logged out), route
const SCREENS = [
  ['01-login', null, '/login'],
  ['02-signup', null, '/signup'],
  ['03-home', 'minji', '/home'],
  ['04-spending-account', 'minji', '/account/sp-minji'],
  ['05-router', 'minji', '/router'],
  ['06-group-couple', 'minji', '/group/g-home'],
  ['07-group-club-owner', 'hana', '/group/g-club'],
  ['08-group-club-member', 'jiho', '/group/g-club'],
  ['09-club-subaccount', 'hana', '/group/g-club?acct=club-trips'],
  ['10-group-church-private', 'minji', '/group/g-church'],
  ['11-group-settings', 'hana', '/group/g-club/settings'],
  ['12-group-number', 'hana', '/group/g-club/router'],
  ['13-setup-couple', 'minji', '/setup'],
  ['14-setup-club', 'minji', '/setup?template=club'],
  ['15-public-page', null, '/public/g-club'],
  ['16-new-account', 'minji', '/new'],
  ['17-transfer-to-club', 'jiho', '/transfer?to=rt-club'],
  ['18-transfer-blocked', 'minji', '/transfer?from=sv-minji&to=church'],
  ['19-pay-from-group', 'hana', '/pay?from=club-trips'],
  ['20-pay-blocked', 'jiho', '/pay?from=club-mkt'],
  ['21-deposit', 'minji', '/deposit'],
  ['22-not-found', 'minji', '/group/does-not-exist'],
  ['23-invitation', 'joon', '/home'],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Step 1: start Chrome and wait for its DevTools endpoint.
const profile = mkdtempSync(join(tmpdir(), 'fbd-capture-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });

let ws;
const cleanup = () => {
  try { ws?.close(); } catch { /* already closed */ }
  try { chrome.kill(); } catch { /* already exited */ }
  // Chrome may hold the profile for a moment after exiting.
  for (let i = 0; i < 10; i++) {
    try { rmSync(profile, { recursive: true, force: true }); break; } catch { /* retry */ }
  }
};
const timer = setTimeout(() => { console.error(`Timed out after ${TIMEOUT_MS / 1000}s`); cleanup(); process.exit(1); }, TIMEOUT_MS);

async function main() {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; !existsSync(portFile); i++) {
    if (i > 100) throw new Error('Chrome did not start');
    await sleep(100);
  }
  await sleep(100);
  const [port, path] = readFileSync(portFile, 'utf8').trim().split('\n');

  ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = () => fail(new Error('DevTools connection failed')); });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = m => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, fail } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
    } else if (msg.method) events.push(msg);
  };
  let session;
  const send = (method, params = {}) => new Promise((ok, fail) => {
    pending.set(++id, { ok, fail });
    ws.send(JSON.stringify({ id, method, params, ...(session && !method.startsWith('Target.') ? { sessionId: session } : {}) }));
  });
  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`Page error: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    return r.result.value;
  };

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  ({ sessionId: session } = await send('Target.attachToTarget', { targetId, flatten: true }));
  await send('Page.enable');
  await send('Runtime.enable');

  // Step 2: load the demo once and keep its seeded data.
  await send('Page.navigate', { url: PAGE });
  for (let i = 0; !events.some(e => e.method === 'Page.loadEventFired'); i++) {
    if (i > 100) throw new Error('Demo page did not load');
    await sleep(100);
  }
  await evaluate(`window.__seed = JSON.stringify(state); true`);
  const errors = events.filter(e => e.method === 'Runtime.exceptionThrown');
  if (errors.length) throw new Error('Demo threw on load: ' + JSON.stringify(errors[0].params.exceptionDetails.text));

  mkdirSync(OUT, { recursive: true });

  // Step 3: capture each screen at each viewport.
  for (const [name, as, route] of SCREENS) {
    for (const [vp, size] of Object.entries(VIEWPORTS)) {
      await send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: size.mobile });
      await evaluate(`
        state = JSON.parse(window.__seed);
        state.me = ${JSON.stringify(as)};
        save();
        location.hash = ${JSON.stringify('#' + route)};
        render();
        document.fonts.ready.then(() => true)`);
      await sleep(400); // let the hashchange render and layout settle
      const thrown = events.filter(e => e.method === 'Runtime.exceptionThrown');
      if (thrown.length) throw new Error(`${name} (${vp}) threw: ${thrown[0].params.exceptionDetails.exception?.description || thrown[0].params.exceptionDetails.text}`);
      // Grow the viewport to the page height before capturing, so elements
      // fixed to the bottom of the screen (the phone tab bar) end up at the
      // bottom of the image instead of across the middle. The height is
      // measured at the real viewport size first, so 100vh layouts (the
      // landing page) are not stretched.
      const height = Math.max(size.height, await evaluate(`Math.ceil(document.documentElement.scrollHeight)`));
      await send('Emulation.setDeviceMetricsOverride', { width: size.width, height, deviceScaleFactor: 1, mobile: size.mobile });
      await sleep(150);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(OUT, `${name}-${vp}.png`), Buffer.from(shot.data, 'base64'));
    }
    console.log(`captured ${name}`);
  }

  // Step 4: close Chrome cleanly.
  await send('Browser.close').catch(() => {});
}

main()
  .then(() => { clearTimeout(timer); cleanup(); console.log(`Saved to ${OUT}`); })
  .catch(err => { clearTimeout(timer); console.error(err.message); cleanup(); process.exit(1); });
