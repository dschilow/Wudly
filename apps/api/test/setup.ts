import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Minimal .env loader for tests (avoids an extra dependency). Loads apps/api/.env
 * so integration tests can reach the local database via DATABASE_URL.
 */
function loadEnv(file: string): void {
  try {
    const content = readFileSync(file, 'utf8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      // Strip surrounding quotes.
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // No .env file — rely on the ambient environment (e.g. CI).
  }
}

loadEnv(resolve(__dirname, '../.env'));
