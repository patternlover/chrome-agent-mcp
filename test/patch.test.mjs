import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  ANCHOR,
  ANCHOR_BRING_TO_FRONT,
  PATCHED,
  PATCHED_BRING_TO_FRONT,
  patchBundle,
} from '../lib/patch.mjs';

// A file shaped like the two bundled call sites we patch.
const FIXTURE = `async doCreateNewPage() {
    const { targetId } = await this._browser._session.send("Target.createTarget", { url: "about:blank", browserContextId: this._browserContextId });
    return this._browser._crPages.get(targetId)._page;
  }
  async bringToFront() {
    await this._mainFrameSession._client.send("Page.bringToFront");
  }
  async updateEmulateMedia() {}
`;

function fixtureFile(body = FIXTURE) {
  const dir = mkdtempSync(join(tmpdir(), 'camcp-'));
  const file = join(dir, 'coreBundle.js');
  writeFileSync(file, body);
  return file;
}

test('creates tabs in the background and disables bringToFront', () => {
  const file = fixtureFile();
  assert.equal(patchBundle(file), 'patched');
  const patched = readFileSync(file, 'utf8');
  assert.ok(patched.includes(PATCHED));
  assert.ok(patched.includes(PATCHED_BRING_TO_FRONT));
});

test('second run is a no-op and leaves the file byte-identical', () => {
  const file = fixtureFile();
  patchBundle(file);
  const afterFirst = readFileSync(file, 'utf8');
  assert.equal(patchBundle(file), 'already');
  assert.equal(readFileSync(file, 'utf8'), afterFirst);
});

test('a stale anchor throws, names it, and leaves the file untouched', () => {
  const body = FIXTURE.replace(ANCHOR_BRING_TO_FRONT, '/* moved elsewhere */');
  const file = fixtureFile(body);
  const before = readFileSync(file, 'utf8');
  assert.throws(() => patchBundle(file), (err) => {
    assert.match(err.message, /anchor/i);
    assert.match(err.message, /bringToFront no-op/);
    assert.ok(err.message.includes(file));
    return true;
  });
  // All or nothing: a half-patched bundle would steal focus silently.
  assert.equal(readFileSync(file, 'utf8'), before);
});

test('each anchor appears exactly once in the fixture', () => {
  assert.equal(FIXTURE.split(ANCHOR).length - 1, 1);
  assert.equal(FIXTURE.split(ANCHOR_BRING_TO_FRONT).length - 1, 1);
});

test('a bundle patched by an older version is completed, not refused', () => {
  // v0.1.0 patched only createTarget; upgrading must add bringToFront in place.
  const file = fixtureFile(FIXTURE.replace(ANCHOR, PATCHED));
  assert.equal(patchBundle(file), 'patched');
  const patched = readFileSync(file, 'utf8');
  assert.equal(patched.split(PATCHED).length - 1, 1);
  assert.equal(patched.split(PATCHED_BRING_TO_FRONT).length - 1, 1);
});
