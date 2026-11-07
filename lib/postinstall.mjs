import { ensurePatch } from './ensure.mjs';

/**
 * What the install step prints. It never throws: npm aborts the whole install
 * when a postinstall fails, and on a git install the dependency this patches is
 * not there yet. The real gate is the run-time check, which refuses to start
 * when the patch is missing.
 */
export function postinstallReport({ ensurePatch: ensure = ensurePatch } = {}) {
  try {
    const { status, bundle } = ensure();
    return status === 'patched'
      ? `[chrome-agent-mcp] patched playwright-core: new tabs are created in the background (${bundle})`
      : `[chrome-agent-mcp] playwright-core already patched (${bundle})`;
  } catch (error) {
    return (
      `[chrome-agent-mcp] patch not applied now (${error.message}). ` +
      'It is applied on first start; if it fails there too, re-anchor the patch for this playwright-core version.'
    );
  }
}
