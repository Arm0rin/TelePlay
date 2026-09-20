import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const mode = String(process.env.DATA_MODE || 'local').toLowerCase() === 'backend' ? 'backend' : 'local';
const apiUrl = String(process.env.API_URL || '').trim().replace(/\/$/, '');
const allowFallback = String(process.env.ALLOW_LOCAL_FALLBACK || 'true').toLowerCase() !== 'false';
const requestTimeout = Math.max(1500, Number(process.env.API_TIMEOUT_MS || 8000));
const healthTimeout = Math.max(1000, Number(process.env.HEALTH_TIMEOUT_MS || 4000));

if (mode === 'backend' && !/^https:\/\//.test(apiUrl)) {
  throw new Error('API_URL must be an HTTPS URL when DATA_MODE=backend');
}

const payload = `(() => {
  // Generated public runtime configuration. No server secrets belong here.
  window.__TELEPLAY_CONFIG__ = Object.freeze(${JSON.stringify({
    DATA_MODE: mode,
    API_URL: apiUrl,
    ALLOW_LOCAL_FALLBACK: allowFallback,
    API_TIMEOUT_MS: requestTimeout,
    HEALTH_TIMEOUT_MS: healthTimeout
  }, null, 2)});
})();
`;

const target = resolve(process.cwd(), 'dist/runtime-config.js');
await writeFile(target, payload, 'utf8');
console.log(`TelePlay runtime config generated: ${target} (${mode})`);
