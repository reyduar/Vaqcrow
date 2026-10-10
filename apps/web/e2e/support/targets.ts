/**
 * Loopback targets shared by `playwright.config.ts` and the specs, so the ports
 * are declared once.
 */
export const APP_PORT = 4311;
export const STUB_API_PORT = 4310;
export const STUB_SUPABASE_PORT = 4312;

export const APP_BASE_URL = `http://127.0.0.1:${APP_PORT}`;
export const STUB_API_BASE_URL = `http://127.0.0.1:${STUB_API_PORT}`;
/** Local Supabase Auth + PostgREST double (`stub-supabase-server.mjs`); never a real project. */
export const STUB_SUPABASE_URL = `http://127.0.0.1:${STUB_SUPABASE_PORT}`;
/** Clearly fake publishable key: the double ignores it, and no real key ever enters E2E. */
export const STUB_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_e2e-local-double-not-a-real-key";

