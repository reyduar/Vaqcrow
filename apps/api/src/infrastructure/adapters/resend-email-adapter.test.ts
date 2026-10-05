import { describe, expect, it } from "vitest";
import type { EmailConfig } from "../../application/config/email-config.js";
import { Secret } from "../../application/config/secret.js";
import type { EmailMessage } from "../../application/ports/email-port.js";
import {
  RESEND_ENDPOINT,
  ResendEmailAdapter,
  UnavailableEmailPort,
  createEmailPort,
  type EmailFetch,
  type EmailHttpResponse
} from "./resend-email-adapter.js";

/** A clearly-fake fixture, never a real credential. */
const API_KEY = "test-resend-key";
const FROM = "Vaqcrow <no-reply@vaqcrow.test>";
const MESSAGE: EmailMessage = {
  to: "admin@example.test",
  subject: "Nueva solicitud: Panadería Horizonte SRL",
  text: "Panadería Horizonte SRL envió su solicitud a revisión."
};

interface CapturedCall {
  readonly url: string;
  readonly init: {
    readonly method: string;
    readonly headers: Record<string, string>;
    readonly body: string;
    readonly signal?: AbortSignal;
  };
}

function fakeFetch(
  outcome: { status: number; body?: unknown } | { status: number; pendingBody: true } | { reject: Error } | { pending: true }
) {
  const calls: CapturedCall[] = [];
  const fetchImpl: EmailFetch = (url, init) => {
    calls.push({ url, init });
    if ("reject" in outcome) {
      return Promise.reject(outcome.reject);
    }
    if ("pending" in outcome) {
      return new Promise<EmailHttpResponse>(() => undefined);
    }
    if ("pendingBody" in outcome) {
      // The response arrives, but reading its body never settles.
      return Promise.resolve({
        status: outcome.status,
        json: () => new Promise<unknown>(() => undefined)
      });
    }
    return Promise.resolve({ status: outcome.status, json: () => Promise.resolve(outcome.body ?? {}) });
  };
  return { fetchImpl, calls };
}

function adapter(fetchImpl: EmailFetch, timeoutMs?: number) {
  return new ResendEmailAdapter(
    timeoutMs === undefined
      ? { apiKey: API_KEY, from: FROM, fetch: fetchImpl }
      : { apiKey: API_KEY, from: FROM, fetch: fetchImpl, timeoutMs }
  );
}

describe("ResendEmailAdapter.send", () => {
  it("returns the provider id on 201 and posts the message with the Bearer key", async () => {
    const { fetchImpl, calls } = fakeFetch({ status: 201, body: { id: "email_123" } });

    const result = await adapter(fetchImpl).send(MESSAGE);

    expect(result).toEqual({ ok: true, id: "email_123" });
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call?.url).toBe(RESEND_ENDPOINT);
    expect(call?.init.method).toBe("POST");
    expect(call?.init.headers["Content-Type"]).toBe("application/json");
    // Fixture key only; the assertion never prints it on success.
    expect(call?.init.headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(JSON.parse(call?.init.body ?? "{}")).toEqual({
      from: FROM,
      to: MESSAGE.to,
      subject: MESSAGE.subject,
      text: MESSAGE.text
    });
  });

  it("accepts a 200 with an id", async () => {
    const { fetchImpl } = fakeFetch({ status: 200, body: { id: "email_456" } });
    expect(await adapter(fetchImpl).send(MESSAGE)).toEqual({ ok: true, id: "email_456" });
  });

  it("maps a 400 or 422 to invalid", async () => {
    for (const status of [400, 422]) {
      const { fetchImpl } = fakeFetch({ status, body: { message: "bad request" } });
      expect(await adapter(fetchImpl).send(MESSAGE)).toEqual({ ok: false, code: "invalid" });
    }
  });

  it("maps 401, 403, 429, 500 and an unexpected status to unavailable", async () => {
    for (const status of [401, 403, 429, 500, 502, 418]) {
      const { fetchImpl } = fakeFetch({ status, body: {} });
      expect(await adapter(fetchImpl).send(MESSAGE)).toEqual({ ok: false, code: "unavailable" });
    }
  });

  it("answers unavailable on a success status without an id", async () => {
    const { fetchImpl } = fakeFetch({ status: 200, body: {} });
    expect(await adapter(fetchImpl).send(MESSAGE)).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps a network rejection or a timeout to network and never throws", async () => {
    const rejected = fakeFetch({ reject: new Error("ECONNRESET") });
    expect(await adapter(rejected.fetchImpl).send(MESSAGE)).toEqual({ ok: false, code: "network" });

    const pending = fakeFetch({ pending: true });
    expect(await adapter(pending.fetchImpl, 5).send(MESSAGE)).toEqual({ ok: false, code: "network" });
  });

  it("bounds the body read with the same deadline, not only the fetch", async () => {
    // The response status arrives in time, but the body never settles; the
    // deadline must cover the read too, or `send` hangs forever.
    const stalled = fakeFetch({ status: 200, pendingBody: true });
    expect(await adapter(stalled.fetchImpl, 5).send(MESSAGE)).toEqual({ ok: false, code: "network" });
  });

  it("never returns the key or a provider message", async () => {
    const { fetchImpl } = fakeFetch({ status: 500, body: { message: `leak ${API_KEY}` } });
    const result = await adapter(fetchImpl).send(MESSAGE);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(API_KEY);
    expect(serialized).not.toContain("leak");
  });
});

describe("UnavailableEmailPort", () => {
  it("always answers unavailable without touching the network", async () => {
    expect(await new UnavailableEmailPort().send(MESSAGE)).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("createEmailPort", () => {
  it("picks the null object when email is disabled, without calling fetch", async () => {
    const { fetchImpl, calls } = fakeFetch({ status: 201, body: { id: "unused" } });
    const port = createEmailPort({ enabled: false, from: FROM, appBaseUrl: "http://localhost:3001" }, fetchImpl);

    expect(port).toBeInstanceOf(UnavailableEmailPort);
    expect(await port.send(MESSAGE)).toEqual({ ok: false, code: "unavailable" });
    expect(calls).toHaveLength(0);
  });

  it("picks the Resend adapter with the configured key and sender when enabled", async () => {
    const { fetchImpl, calls } = fakeFetch({ status: 201, body: { id: "email_789" } });
    const config: EmailConfig = {
      enabled: true,
      apiKey: new Secret(API_KEY),
      from: FROM,
      appBaseUrl: "http://localhost:3001"
    };
    const port = createEmailPort(config, fetchImpl);

    expect(port).toBeInstanceOf(ResendEmailAdapter);
    expect(await port.send(MESSAGE)).toEqual({ ok: true, id: "email_789" });
    expect(JSON.parse(calls[0]?.init.body ?? "{}")).toMatchObject({ from: FROM, to: MESSAGE.to });
  });
});
