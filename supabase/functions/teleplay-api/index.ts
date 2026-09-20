import api from './server/index.mjs';
import { createPostgresDatabase } from './server/postgres-db.mjs';

let databasePromise: ReturnType<typeof createPostgresDatabase> | null = null;
// Telegram identity is still cryptographically verified with the bot token.
// This public numeric ID is the project-level owner configuration used by the
// Admin UI as well; keeping it as a final fallback prevents an empty Edge
// secret from turning the client and API into two conflicting authority lists.
const DEFAULT_OWNER_ID = '1328706856';

const env = (name: string, fallback = '') => {
  const value = Deno.env.get(name)?.trim();
  return value || fallback;
};

Deno.serve(async (request: Request) => {
  const databaseUrl = env('DATABASE_URL') || env('SUPABASE_DB_URL');
  const runtimeEnv = {
    TELEGRAM_BOT_TOKEN: env('TELEGRAM_BOT_TOKEN'),
    // Keep the Edge adapter aligned with the shared API's supported secret
    // names.  This matters for an existing production project where the
    // owner and origin may have been configured under the TELEPLAY_* names.
    TELEPLAY_OWNER_IDS: env('TELEPLAY_OWNER_IDS'),
    TELEPLAY_OWNER_ID: env('TELEPLAY_OWNER_ID'),
    OWNER_ID: env('OWNER_ID', DEFAULT_OWNER_ID),
    TELEPLAY_WEB_ORIGIN: env('TELEPLAY_WEB_ORIGIN'),
    WEB_ORIGIN: env('WEB_ORIGIN'),
    TELEPLAY_INIT_DATA_MAX_AGE: env('TELEPLAY_INIT_DATA_MAX_AGE', '86400'),
    TELEPLAY_PAYMENT_PACKAGES: env('TELEPLAY_PAYMENT_PACKAGES'),
    TELEGRAM_PAYMENT_PROVIDER_TOKEN: env('TELEGRAM_PAYMENT_PROVIDER_TOKEN'),
    PAYMENT_PROVIDER_TOKEN: env('PAYMENT_PROVIDER_TOKEN'),
    TELEPLAY_PAYMENT_WEBHOOK_SECRET: env('TELEPLAY_PAYMENT_WEBHOOK_SECRET'),
    PAYMENT_WEBHOOK_SECRET: env('PAYMENT_WEBHOOK_SECRET')
  };
  if (!databaseUrl) {
    // Let the shared handler produce its normal CORS-aware 503 response. This
    // also keeps browser OPTIONS preflight requests working before secrets are
    // configured in the Supabase dashboard.
    return api.fetch(request, { DB: null, ...runtimeEnv });
  }
  databasePromise ||= createPostgresDatabase(databaseUrl);
  const DB = await databasePromise;
  return api.fetch(request, {
    DB,
    ...runtimeEnv
  });
});
