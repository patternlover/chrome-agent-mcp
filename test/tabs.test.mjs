import assert from 'node:assert/strict';
import test from 'node:test';

import { formatTabs } from '../lib/tabs.mjs';

const TARGETS = [
  { id: '98B2A5F0AA11', type: 'page', title: 'GTM preview', url: 'https://example.com/?gtm_preview=env-2' },
  { id: '6F218500BB22', type: 'page', title: '', url: 'https://example.org/' },
  { id: 'CC3300DDEE44', type: 'service_worker', title: '', url: 'https://example.com/sw.js' },
];

test('lists one line per page, short id first, title then url', () => {
  const lines = formatTabs(TARGETS).split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^98B2A5\s+GTM preview\s+https:\/\/example\.com/);
  assert.match(lines[1], /^6F2185\s+\(untitled\)\s+https:\/\/example\.org\//);
});

test('service workers are not tabs', () => {
  assert.ok(!formatTabs(TARGETS).includes('sw.js'));
});

test('an empty browser says so instead of printing nothing', () => {
  assert.match(formatTabs([]), /no open tabs/i);
});
