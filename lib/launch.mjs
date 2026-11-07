// How Chrome is started and where its profile lives. Pure functions: the CLI
// only spawns what these describe, so both platforms are testable without a browser.

export const CHROME_APP = 'Google Chrome';
export const WIN_CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

/** Flags Chrome needs to be a browser an agent can measure in, not just control. */
export function buildChromeArgs({ profileDir, port, url = 'about:blank' }) {
  return [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    // Without these a background tab throttles its timers: GTM and dataLayer
    // observations would be late, and the measurement would be wrong.
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    url,
  ];
}

export function launchPlan({ platform, profileDir, port, chromePath, url }) {
  const args = buildChromeArgs({ profileDir, port, url });
  if (platform === 'darwin') {
    // -g: do not bring the application to the foreground. -n: a second instance
    // even when the human's own Chrome is already running. CHROME_PATH is an
    // app bundle here (`open -a` takes an app, not the binary inside it), which
    // is how Canary or a non standard install is named on this platform.
    return { command: 'open', args: ['-g', '-n', '-a', chromePath ?? CHROME_APP, '--args', ...args] };
  }
  if (platform === 'win32') {
    return { command: chromePath ?? WIN_CHROME, args };
  }
  throw new Error(`platform not supported: ${platform} (only darwin and win32)`);
}

export function profileDir({ platform, home, localAppData }) {
  if (platform === 'win32') {
    return `${localAppData ?? `${home}\\AppData\\Local`}\\chrome-agent-mcp\\profile`;
  }
  return `${home}/.local/share/chrome-agent-mcp/profile`;
}

/**
 * Where the MCP writes screenshots and snapshots it names itself. Outside any
 * project on purpose: Playwright MCP defaults to `<cwd>/.playwright-mcp`, and
 * an MCP launched by the agent inherits the project as its cwd.
 */
export function outputDir({ platform, home, localAppData }) {
  if (platform === 'win32') {
    return `${localAppData ?? `${home}\\AppData\\Local`}\\chrome-agent-mcp\\output`;
  }
  return `${home}/.local/share/chrome-agent-mcp/output`;
}
