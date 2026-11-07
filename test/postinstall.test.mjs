import assert from 'node:assert/strict';
import test from 'node:test';

import { postinstallReport } from '../lib/postinstall.mjs';

test('a patched install reports that it patched', () => {
  const report = postinstallReport({ ensurePatch: () => ({ status: 'patched', bundle: '/x/coreBundle.js' }) });
  assert.match(report, /patched/i);
  assert.match(report, /\/x\/coreBundle\.js/);
});

test('an already patched install says so', () => {
  const report = postinstallReport({ ensurePatch: () => ({ status: 'already', bundle: '/x/coreBundle.js' }) });
  assert.match(report, /already/i);
});

test('a failure is reported, not thrown: npm would abort the whole install', () => {
  const report = postinstallReport({
    ensurePatch: () => {
      throw new Error('anchor not found');
    },
  });
  assert.match(report, /not applied/i);
  assert.match(report, /anchor not found/);
  assert.match(report, /first start/i);
});
