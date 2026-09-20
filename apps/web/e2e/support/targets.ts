/**
 * Loopback targets shared by `playwright.config.ts` and the specs, so the ports
 * and the placeholder application id are declared once.
 */
export const APP_PORT = 4311;
export const STUB_API_PORT = 4310;

export const APP_BASE_URL = `http://127.0.0.1:${APP_PORT}`;
export const STUB_API_BASE_URL = `http://127.0.0.1:${STUB_API_PORT}`;

/**
 * Same placeholder id the demo UI uses (`src/application/fixtures/demo-application.ts`).
 * Duplicated literally on purpose: `e2e/` must not import from `src/` (Playwright does
 * not resolve the `@/*` alias, and the fixture is app data, not a test contract).
 */
export const DEMO_APPLICATION_ID = "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f";
