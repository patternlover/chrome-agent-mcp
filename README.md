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
| `chrome-agent-mcp close` | quits that Chrome; the profile keeps its logins, the port closes |
| `chrome-agent-mcp status` | prints whether the port answers, the browser, the profile |
| `chrome-agent-mcp tab [--window] [--label <name>] <url>` | opens a tab **in the background**, prints its target id; `--window` gives it its own window, `--label` prefixes the page title |
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
- The profile is a real Chrome profile with real cookies: see **Security** below.

## Two agents on one Chrome

Measured with two MCP clients attached to the same browser: they do not kill each other and they do
not close the debug connection of the other one — one client's `browser_close` closed its page, the
other kept working, the browser stayed up.

What does **not** exist is isolation. Every client sees every page (`tabs seen by A: 3 | by B: 3`),
and tab indices are per-client lists, so `tab 1` means two different pages to two agents. Chrome tab
groups are not reachable from CDP at all: the protocol has `createTarget`, `attachToTarget`,
`activateTarget`, `closeTarget` and window bounds, while grouping lives in the extension API
(`chrome.tabs.group`) — that is what the Playwright Extension gives you, one coloured group per
client, as soon as its background mode ships.

Measured with two agents doing actual work side by side (5 rounds of navigate, set a marker in the
page, read it back): every round correct for both, no state bleeding between their pages, one
agent's `browser_close` left the other working, the browser survived 43 pages, and the frontmost app
never changed.

The failures come from the other direction: **inside one client**. Twelve parallel
`tabs new` + `navigate` calls from the same agent produced 9 `net::ERR_ABORTED`, because the MCP
keeps a "current tab" per client and parallel calls move it under each other. The same work done
serially inside each agent, in parallel across agents, failed zero times.

So the working rules, until then:

- parallel between agents, serial inside one: an agent that needs many tabs opens them one after
  the other;

- an agent opens the tabs it needs with `chrome-agent-mcp tab --label <name> <url>`, and never
  touches tabs it did not open;
- `chrome-agent-mcp close` is the human's command: it takes the browser away from every agent;
- `--window` opens a tab in a new window and was measured focus-neutral, but it does **not** keep
  an agent there: with an agent's tab in window `319208161`, the MCP's own `browser_tabs new` put
  the next tab back in the original window `319208159`. A window per agent holds only for the tabs
  opened through `chrome-agent-mcp tab --window`, which is rarely the shape of a real task.

## Security

The Chrome DevTools port has **no authentication**. Chrome says so in their own note on
[remote debugging](https://developer.chrome.com/blog/remote-debugging-port): while the port is open,
any process of the same user can list the tabs and read the profile's cookies through the protocol.
There is no flag for a password or a token, and none can be added by configuration — a token in
front of the port would gate your client, not the port.

So the port is treated as a session, not as a service: open it when the agent has work to do, close
it after.

```bash
chrome-agent-mcp open     # while working
chrome-agent-mcp close    # when done: Chrome quits, logins stay in the profile
```

The alternatives, when this is not enough: Playwright can launch the browser itself with
`--remote-debugging-pipe`, which removes the port entirely (CDP travels on file descriptors 3 and 4;
measured: zero listening sockets, no `DevToolsActivePort`), at the cost of one focus event at launch
and a browser whose lifetime is the MCP session. The Playwright Extension takes the other route — no
port, token per profile, per-client tab groups — but its background mode is not in the published
MCP yet.

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
