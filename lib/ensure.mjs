import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { patchBundle } from './patch.mjs';

const defaultLayout = (packageJsonPath) => join(dirname(packageJsonPath), 'lib', 'coreBundle.js');

/**
 * Patches the playwright-core that will actually be loaded at run time.
 * Called on every start, not only at install: npm 11 blocks install scripts
 * unless they are explicitly allowed, so an install-time-only patch would be
 * silently missing.
 */
export function ensurePatch({ resolve, layout = defaultLayout } = {}) {
  let packageJson;
  try {
    packageJson = resolve
      ? resolve('playwright-core/package.json')
      : createRequire(import.meta.url).resolve('playwright-core/package.json');
  } catch (error) {
    throw new Error(
      `playwright-core not found (${error.message}). Reinstall the package: npm i -g patternlover/chrome-agent-mcp`,
    );
  }
  const bundle = layout(packageJson);
  return { bundle, status: patchBundle(bundle) };
}
