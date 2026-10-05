import type { EmailConfig } from "../../application/config/email-config.js";
import type { EmailMessage, EmailPort, EmailSendResult } from "../../application/ports/email-port.js";

/**
 * Resend HTTP API adapter (Feature #382, Task #383 / T1b-2).
 *
 * `POST https://api.resend.com/emails` with the API key as a bearer token.
 * `send` never throws into the caller: an email is best-effort, so a delivery
 * failure is a result the publisher counts and moves on from. The key is only
 * ever placed in the request header; it is never part of the returned value or
 * of any log line.
 */

export const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_TIMEOUT_MS = 5_000;

/** The slice of `Response` the adapter reads, so tests can inject a fake fetch. */
export interface EmailHttpResponse {
  readonly status: number;
  json(): Promise<unknown>;
}

/** The slice of `fetch` the adapter uses; injectable so tests never hit the network. */
export type EmailFetch = (
  url: string,
  init: {
    readonly method: string;
    readonly headers: Record<string, string>;
    readonly body: string;
    readonly signal?: AbortSignal;
  }
) => Promise<EmailHttpResponse>;

export interface ResendEmailAdapterOptions {
  readonly apiKey: string;
  readonly from: string;
  readonly fetch: EmailFetch;
  readonly timeoutMs?: number;
}

export class ResendEmailAdapter implements EmailPort {
  private readonly timeoutMs: number;

  constructor(private readonly options: ResendEmailAdapterOptions) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("email request timed out"));
      }, this.timeoutMs);
    });

    try {
      const response = await Promise.race([
        this.options.fetch(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.options.apiKey}`
          },
          body: JSON.stringify({
            from: this.options.from,
            to: message.to,
            subject: message.subject,
            text: message.text
          }),
          signal: controller.signal
        }),
        deadline
      ]);

      const status = response.status;

      if (status === 200 || status === 201) {
        // The deadline covers the body read too: the response status arriving in
        // time is not enough if reading its body then stalls indefinitely.
        const id = readId(await Promise.race([safeJson(response), deadline]));
        return id === undefined ? { ok: false, code: "unavailable" } : { ok: true, id };
      }

      if (status === 400 || status === 422) {
        return { ok: false, code: "invalid" };
      }

      // 401/403/429/5xx and anything unexpected: the message was not accepted.
      return { ok: false, code: "unavailable" };
    } catch {
      // A throw or a timeout is a transport failure, never a caller failure.
      return { ok: false, code: "network" };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * The null object for a process with no Resend key: email is disabled, not
 * broken, so every send reports `unavailable` and the caller carries on.
 */
export class UnavailableEmailPort implements EmailPort {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the null object ignores the message by design
  async send(_message: EmailMessage): Promise<EmailSendResult> {
    return { ok: false, code: "unavailable" };
  }
}

/**
 * Picks the real adapter or the null object from the validated config. `fetch`
 * is injectable so tests exercise the HTTP contract with a fake.
 */
export function createEmailPort(
  config: EmailConfig,
  fetchImplementation: EmailFetch = globalThis.fetch as unknown as EmailFetch
): EmailPort {
  if (!config.enabled) {
    return new UnavailableEmailPort();
  }

  return new ResendEmailAdapter({
    apiKey: config.apiKey.reveal(),
    from: config.from,
    fetch: fetchImplementation
  });
}

function readId(body: unknown): string | undefined {
  if (body === null || typeof body !== "object" || !("id" in body)) {
    return undefined;
  }
  const id = (body as { readonly id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

async function safeJson(response: EmailHttpResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
