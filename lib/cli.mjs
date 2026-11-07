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

/**
 * `tab` arguments. A separate window is how one agent's work stays visually
 * apart from another's: Chrome tab groups exist only in the extension API, not
 * in CDP, and Target.createTarget({ newWindow: true, background: true }) was
 * measured as focus-neutral on macOS.
 */
export function parseTabArgs(rest) {
  let newWindow = false;
  let label = null;
  const args = [...rest];
  const url = [];
  while (args.length) {
    const arg = args.shift();
    if (arg === '--window') newWindow = true;
    else if (arg === '--label') {
      label = args.shift();
      if (!label) throw new Error('--label needs a value');
    } else if (arg.startsWith('-')) throw new Error(`unknown flag: ${arg}`);
    else url.push(arg);
  }
  if (!url.length) throw new Error('usage: chrome-agent-mcp tab [--window] [--label <name>] <url>');
  return { url: url[0], newWindow, label };
}
