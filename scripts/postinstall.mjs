// Best effort, never fatal: a failing postinstall aborts the whole install, and
// on a git install the playwright-core this patches is not there yet. The real
// gate is the run-time check in bin/chrome-agent-mcp.
import { postinstallReport } from '../lib/postinstall.mjs';

console.log(postinstallReport());
