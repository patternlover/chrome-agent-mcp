import assert from 'node:assert/strict';
import test from 'node:test';

import { buildChromeArgs, launchPlan, profileDir } from '../lib/launch.mjs';

const base = { profileDir: '/tmp/profile', port: 9223 };

test('chrome args carry the debug port, the profile and the throttling flags', () => {
  const args = buildChromeArgs(base);
  for (const expected of [
    '--remote-debugging-port=9223',
    '--user-data-dir=/tmp/profile',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ]) {
    assert.ok(args.includes(expected), `missing ${expected}`);
  }
});

test('macOS launches through open without bringing Chrome to the foreground', () => {
  const plan = launchPlan({ ...base, platform: 'darwin' });
  assert.equal(plan.command, 'open');
  assert.ok(plan.args.includes('-g'), 'open must not foreground the app');
  assert.ok(plan.args.includes('-a'));
  assert.ok(plan.args.includes('--args'));
});

test('windows launches the chrome binary directly, with no open --args', () => {
  const plan = launchPlan({ ...base, platform: 'win32', chromePath: 'C:\\Chrome\\chrome.exe' });
  assert.equal(plan.command, 'C:\\Chrome\\chrome.exe');
  assert.ok(!plan.args.includes('--args'));
  assert.ok(plan.args.includes('--remote-debugging-port=9223'));
});

test('an unsupported platform fails loudly instead of guessing', () => {
  assert.throws(() => launchPlan({ ...base, platform: 'linux' }), /platform/i);
});

test('the profile dir is per platform and per user', () => {
  assert.match(profileDir({ platform: 'darwin', home: '/Users/e' }), /^\/Users\/e\/.local\/share\/chrome-agent-mcp\/profile$/);
  assert.match(profileDir({ platform: 'win32', home: 'C:\\Users\\E', localAppData: 'C:\\Users\\E\\AppData\\Local' }), /chrome-agent-mcp.profile$/i);
});
