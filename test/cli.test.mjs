import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_PORT, mcpArgs, parseArgs, resolvePort } from '../lib/cli.mjs';

test('no subcommand means the MCP server, with the port injected', () => {
  const { cmd, rest } = parseArgs([]);
  assert.equal(cmd, 'mcp');
  assert.deepEqual(mcpArgs({ port: 9223, rest }), ['--cdp-endpoint', 'http://127.0.0.1:9223']);
});

test('extra flags after the MCP command reach playwright-mcp untouched', () => {
  const { cmd, rest } = parseArgs(['--headless', '--caps=vision']);
  assert.equal(cmd, 'mcp');
  assert.deepEqual(mcpArgs({ port: 9223, rest }).slice(2), ['--headless', '--caps=vision']);
});

test('close is a subcommand, not a flag for the MCP', () => {
  assert.deepEqual(parseArgs(['close']), { cmd: 'close', rest: [] });
});

test('helper subcommands keep their own arguments', () => {
  assert.deepEqual(parseArgs(['tab', 'https://example.com']), { cmd: 'tab', rest: ['https://example.com'] });
  assert.deepEqual(parseArgs(['status']), { cmd: 'status', rest: [] });
});

test('the port comes from the environment, defaulting to 9223', () => {
  assert.equal(resolvePort({}), DEFAULT_PORT);
  assert.equal(resolvePort({ CHROME_AGENT_MCP_PORT: '9400' }), 9400);
  assert.throws(() => resolvePort({ CHROME_AGENT_MCP_PORT: 'abc' }), /port/i);
});
