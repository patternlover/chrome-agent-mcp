import { readFileSync, writeFileSync } from 'node:fs';

// Two one-line patches to playwright-core's bundle. Both exist for the same
// reason: on macOS anything that brings the browser's tab to the foreground also
// activates the application, and the human's keystrokes stop landing where they
// were typing.

// 1. Creating a page. Chromium's Target.createTarget defaults to a foreground
//    tab; `background: true` creates it without activating the app.
export const ANCHOR = '{ url: "about:blank", browserContextId: this._browserContextId }';
export const PATCHED = '{ url: "about:blank", browserContextId: this._browserContextId, background: true }';

// 2. Switching to a page. Page.bringToFront, Target.activateTarget and
//    ActivateContents all end in the same place: measured on macOS, every call
//    raised the app (upstream PR #41430 tried to fix this and was reverted).
export const ANCHOR_BRING_TO_FRONT = 'await this._mainFrameSession._client.send("Page.bringToFront");';
export const PATCHED_BRING_TO_FRONT =
  '/* chrome-agent-mcp: bringToFront disabled, on macOS it activates the window */';

export const PATCHES = [
  { name: 'createTarget background', anchor: ANCHOR, replacement: PATCHED },
  { name: 'bringToFront no-op', anchor: ANCHOR_BRING_TO_FRONT, replacement: PATCHED_BRING_TO_FRONT },
];

/**
 * Patches one bundled playwright-core file. All or nothing: a half-patched
 * bundle would steal focus in a way nobody notices until it happens.
 * Returns 'patched' or 'already'.
 */
export function patchBundle(file, patches = PATCHES) {
  const source = readFileSync(file, 'utf8');

  const pending = [];
  const stale = [];
  for (const p of patches) {
    if (source.includes(p.replacement)) continue; // applied by an earlier version
    const hits = source.split(p.anchor).length - 1;
    if (hits === 1) pending.push(p);
    else stale.push(`"${p.name}": ${hits} occurrences`);
  }
  if (stale.length) {
    throw new Error(
      `anchor not found in ${file} (${stale.join(', ')}): playwright-core is not the version this patch expects. ` +
        'Re-anchor the patch for this version before publishing.',
    );
  }
  if (!pending.length) return 'already';

  let next = source;
  for (const p of pending) next = next.replace(p.anchor, p.replacement);
  writeFileSync(file, next);
  return 'patched';
}
