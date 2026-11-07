# chrome-agent-mcp

Playwright MCP over **a Chrome window you stay logged into**, that does not steal your focus
when the agent opens a tab.

You keep working in your own browser on one screen; the agent drives and you watch in another
window, already logged into the sites it needs.

## Install

Two paths, both exercised end to end on macOS with npm 11.17 (2026-11-07).

**No install, via npx** — nothing to keep updated, the MCP fetches the repo:

```json
{
  "mcpServers": {
    "playwright": { "command": "npx", "args": ["-y", "github:patternlover/chrome-agent-mcp"] }
  }
}
```

**As a project dependency**, when you want it pinned:

```bash
npm i github:patternlover/chrome-agent-mcp
```

```json
{
  "mcpServers": {
    "playwright": { "command": "chrome-agent-mcp" }
  }
}
```

`npm i -g patternlover/chrome-agent-mcp` is **not** verified: on this machine npm 11 fails with
`spawn sh ENOENT` when a git spec is installed globally with a custom prefix. Use one of the two
above, or install globally where npm's prefix is writable and check that `chrome-agent-mcp status`
prints the patch line.

Then, once, start the browser it will drive:

```bash
chrome-agent-mcp open      # starts Chrome detached, not in the foreground
chrome-agent-mcp status    # port 9223 open, which browser, which profile
```

Log into whatever the agent needs **in that window** (its profile is persistent:
`~/.local/share/chrome-agent-mcp/profile` on macOS,
`%LOCALAPPDATA%\chrome-agent-mcp\profile` on Windows). It survives restarts.

## Why this exists

Two Playwright calls bring the browser's tab to the foreground, and on macOS that **activates the
application**: your keystrokes stop landing where you were typing. Measured on macOS 2026-11-07,
frontmost app before/after each step, through the MCP itself:

| step | frontmost |
|---|---|
| `initialize` | unchanged |
| `browser_tabs new` | unchanged |
| `browser_navigate` | unchanged |
| `browser_tabs select` (the `bringToFront` path) | unchanged |
| `browser_click`, `browser_evaluate`, `browser_type`, `browser_snapshot`, `browser_take_screenshot` | unchanged |
| `window.open(...)` from a page | **Chrome**, for about a second |

and, without the patches:

| step | frontmost |
|---|---|
| `newPage()` | **Chrome** |
| `page.bringToFront()` | **Chrome** |
| `Target.activateTarget` | **Chrome** |

The one step that still raises the browser is a popup the page opens itself (`target=_blank`, an
OAuth sign-in window): that tab is created by Chrome, not by Playwright, so no client-side patch
can make it background. It is transient — macOS gives the focus back — and it is avoided by
navigating in the same tab instead of opening a window.

Upstream tried twice (microsoft/playwright#41430 merged then reverted by #41734;
`createPagesInBackground` #41282 closed unmerged), so the fix has to be carried here. This package
patches exactly two call sites in the bundled `playwright-core/lib/coreBundle.js`:

```diff
- { url: "about:blank", browserContextId: this._browserContextId }
+ { url: "about:blank", browserContextId: this._browserContextId, background: true }

- await this._mainFrameSession._client.send("Page.bringToFront");
+ /* chrome-agent-mcp: bringToFront disattivato, su macOS attiva la finestra */
```

The second one is not cosmetic: `Page.bringToFront`, `Target.activateTarget` and Chromium's
`ActivateContents` all end up activating the window, so **switching tab always costs the focus**.
Disabling it is what makes `browser_tabs select` safe, and it has a visible consequence: the
window no longer follows the agent. The agent works on whatever tab it selected, the window keeps
showing the tab you last clicked. To see what it has open, ask it to run `chrome-agent-mcp tabs`.

Both patches are **idempotent** and applied **on every start**, not only at install: npm 11 skips
install scripts unless they are allowed, and on a git install the dependency is not there yet when
the script runs. The install step only reports; the run-time check is the gate — if the patch
cannot be applied, the MCP refuses to start instead of quietly stealing your focus. Both patches
are applied all or nothing, so a half-patched bundle is never left behind.

## Commands

| command | what it does |
|---|---|
| `chrome-agent-mcp` | runs the MCP server (stdio), attached to the local Chrome |
| `chrome-agent-mcp open` | starts Chrome with the debug port, without bringing it to the foreground |
| `chrome-agent-mcp status` | prints whether the port answers, the browser, the profile |
| `chrome-agent-mcp tab <url>` | opens a tab **in the background**, prints its target id |
| `chrome-agent-mcp tabs` | lists the open pages (id, title, url) |
| `chrome-agent-mcp help` | usage |

Flags after the command go to `playwright-mcp` untouched:
`chrome-agent-mcp --caps=vision`.

Environment: `CHROME_AGENT_MCP_PORT` (default `9223`), `CHROME_PATH` (Chrome binary).

## Limits

- **Popups still activate Chrome** for about a second (see the table above).
- **The window does not follow the agent.** Disabling `bringToFront` is what keeps the focus:
  a tab switch activates the app on macOS. Watch the tab you clicked, ask the agent for
  `chrome-agent-mcp tabs` to know what it has open.
- **macOS and Windows only.** Linux is refused rather than guessed. Windows is unit-tested, not
  exercised on a real machine.
- **Google Chrome and Chrome for Testing**, like `@playwright/mcp` itself. Arc, Stedding and
  other Chromium forks are unsupported: the debug port may work, nothing is guaranteed.
- **No extension tooling.** For install/reload/inspect of extensions use
  `chrome-devtools-mcp`, which attaches to Chrome but not to Electron or unsupported forks.
- The browser is started with `--disable-background-timer-throttling`,
  `--disable-backgrounding-occluded-windows`, `--disable-renderer-backgrounding`: without them
  a background tab throttles its timers and GTM / dataLayer measurements come out late.
- The profile is a real Chrome profile with real cookies. Treat the debug port as a local
  security hole: any process on the machine can drive that browser while it is open.

## Development

```bash
npm test          # node --test: patcher (applies both, idempotent, completes a half-patched
                  # bundle, refuses a stale anchor leaving the file untouched), launcher, CLI, tabs
```

The patcher is tested against a fixture, so the suite runs without Playwright installed.

### Upgrading the pin

`@playwright/mcp` pins a `playwright-core` version and the two anchors are tied to it. On a bump:
`npm i`, then `npm test`, then `node scripts/postinstall.mjs` — a stale anchor fails loudly and
names the patch that needs re-anchoring.
