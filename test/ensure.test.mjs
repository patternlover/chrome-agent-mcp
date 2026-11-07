import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { ensurePatch } from '../lib/ensure.mjs';
import { ANCHOR, ANCHOR_BRING_TO_FRONT, PATCHED } from '../lib/patch.mjs';

function fakeInstall(body) {
  const dir = mkdtempSync(join(tmpdir(), 'camcp-ensure-'));
  writeFileSync(join(dir, 'package.json'), '{"name":"playwright-core"}');
  writeFileSync(join(dir, 'coreBundle.js'), body ?? `${ANCHOR}\n${ANCHOR_BRING_TO_FRONT}\n`);
  return dir;
}

test('patches the installed playwright-core it resolves, and says where', () => {
  const dir = fakeInstall();
  const { bundle, status } = ensurePatch({ resolve: () => join(dir, 'package.json'), layout: () => join(dir, 'coreBundle.js') });
  assert.equal(status, 'patched');
  assert.equal(bundle, join(dir, 'coreBundle.js'));
  assert.ok(readFileSync(bundle, 'utf8').includes(PATCHED));
});

test('a second call reports already, it does not rewrite', () => {
  const dir = fakeInstall();
  const args = { resolve: () => join(dir, 'package.json'), layout: () => join(dir, 'coreBundle.js') };
  ensurePatch(args);
  assert.equal(ensurePatch(args).status, 'already');
});

test('when playwright-core is missing the error says how to install it', () => {
  assert.throws(
    () => ensurePatch({ resolve: () => { throw new Error('MODULE_NOT_FOUND'); } }),
    (err) => {
      assert.match(err.message, /playwright-core/);
      assert.match(err.message, /npm i/);
      return true;
    },
  );
});
