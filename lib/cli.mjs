export const DEFAULT_PORT = 9223;
const COMMANDS = new Set(['open', 'close', 'status', 'tab', 'tabs', 'help']);

/** argv after the binary name. No subcommand means: be the MCP server. */
export function parseArgs(argv) {
  const [first, ...rest] = argv;
  if (COMMANDS.has(first)) return { cmd: first, rest };
  return { cmd: 'mcp', rest: argv };
}

export function resolvePort(env) {
  const raw = env.CHROME_AGENT_MCP_PORT;
  if (raw === undefined || raw === '') return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`invalid CHROME_AGENT_MCP_PORT: ${raw}`);
  }
  return port;
}

/** Arguments for playwright-mcp: it attaches to the Chrome we started, it does not launch one. */
export function mcpArgs({ port, rest }) {
  return ['--cdp-endpoint', `http://127.0.0.1:${port}`, ...rest];
}
