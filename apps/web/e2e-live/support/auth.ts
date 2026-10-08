import { pollUntil } from "./poll";

/**
 * Real Supabase Auth (local stack) for the admin-review live rehearsal:
 * GoTrue REST for sign-in/sign-up outside the browser and the local Mailpit
 * API (`docs/architecture/environments.md` §4, «Email local») for the
 * confirmation link. Nothing here is a double: the link is the one GoTrue
 * actually sent, and following it is what confirms the account.
 *
 * Access tokens live only in this Node process's memory; they are never
 * printed.
 */
export const LIVE_MAILPIT_URL = "http://127.0.0.1:54324";

export interface SupabaseTarget {
  readonly url: string;
  readonly publishableKey: string;
}

interface MailpitSearch {
  readonly messages?: readonly { readonly ID: string }[];
}

interface MailpitMessage {
  readonly Text?: string;
  readonly HTML?: string;
}

/** Waits for the confirmation email GoTrue sent to `email` and returns its verify link. */
export async function confirmationLinkFor(email: string): Promise<string> {
  const query = encodeURIComponent(`to:"${email}"`);
  const search = await pollUntil(
    async () => {
      const response = await fetch(`${LIVE_MAILPIT_URL}/api/v1/search?query=${query}`);
      if (!response.ok) throw new Error(`Mailpit search returned ${String(response.status)}`);
      return (await response.json()) as MailpitSearch;
    },
    (body) => (body.messages?.length ?? 0) > 0,
    { timeoutMs: 30_000, intervalMs: 1_000, description: `the confirmation email to ${email} in Mailpit` }
  );

  const id = search.messages?.[0]?.ID;
  if (!id) throw new Error(`Mailpit returned no message id for ${email}`);
  const response = await fetch(`${LIVE_MAILPIT_URL}/api/v1/message/${id}`);
  if (!response.ok) throw new Error(`Mailpit message read returned ${String(response.status)}`);
  const message = (await response.json()) as MailpitMessage;
  const body = `${message.Text ?? ""}\n${message.HTML ?? ""}`;
  const link = /https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]+/.exec(body)?.[0];
  if (!link) throw new Error(`The confirmation email to ${email} carries no /auth/v1/verify link`);
  return link.replace(/&amp;/g, "&");
}

/** Follows the verify link exactly as a mail client would (GoTrue confirms, then redirects to the site). */
export async function confirmEmail(email: string): Promise<void> {
  const link = await confirmationLinkFor(email);
  const response = await fetch(link, { redirect: "manual" });
  // GoTrue answers 303 to the redirect target on success; a 4xx means the
  // token was refused.
  if (response.status >= 400) {
    throw new Error(`Following the confirmation link for ${email} returned ${String(response.status)}`);
  }
}

/** GoTrue sign-up with the same `options.data` shape the web's `SupabaseAuthSession.signUp` sends. */
export async function signUpThroughAuthApi(
  target: SupabaseTarget,
  input: { readonly email: string; readonly password: string; readonly role: "PYME" | "INVERSOR"; readonly displayName: string }
): Promise<void> {
  const response = await fetch(`${target.url}/auth/v1/signup`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: target.publishableKey },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      data: { role: input.role, display_name: input.displayName }
    })
  });
  if (!response.ok) {
    throw new Error(`GoTrue sign-up for ${input.email} returned ${String(response.status)}`);
  }
}

/** Password grant; resolves the access token (kept in memory, never printed). */
export async function accessTokenFor(target: SupabaseTarget, email: string, password: string): Promise<string> {
  const response = await fetch(`${target.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: target.publishableKey },
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) {
    throw new Error(`GoTrue password sign-in for ${email} returned ${String(response.status)}`);
  }
  const body = (await response.json()) as { access_token?: unknown };
  if (typeof body.access_token !== "string" || body.access_token.length === 0) {
    throw new Error(`GoTrue password sign-in for ${email} returned no access token`);
  }
  return body.access_token;
}
