// Applies the postinstall patch to the playwright-core this package installed.
// Fails loudly: a silently unpatched install would steal the user's focus.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { patchBundle } from '../lib/patch.mjs';

const require = createRequire(import.meta.url);

try {
  const bundle = join(dirname(require.resolve('playwright-core/package.json')), 'lib', 'coreBundle.js');
  const result = patchBundle(bundle);
  console.log(
    result === 'patched'
      ? '[chrome-agent-mcp] patched playwright-core: new tabs are created in the background'
      : '[chrome-agent-mcp] playwright-core already patched',
  );
} catch (error) {
  console.error(`[chrome-agent-mcp] PATCH NOT APPLIED: ${error.message}`);
  console.error('[chrome-agent-mcp] Without this patch the browser steals focus when the agent opens a tab.');
  process.exit(1);
}
