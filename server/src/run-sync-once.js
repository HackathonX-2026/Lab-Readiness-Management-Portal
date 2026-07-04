// Standalone script: run a single sync and exit. Useful for cron OS-level jobs
// or to test the pipeline without booting the HTTP server.
import { runSync } from './sync.js';

try {
  const result = await runSync();
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
