import { Writable } from "node:stream";
import type { FastifyInstance, FastifyServerOptions } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { createLoggerOptions } from "../../logging/logger-options.js";
import { buildApp } from "../build-app.js";
import { bearer, fakeAuthPort } from "../test-support/auth.js";

/** A logger that swallows nothing: every pino line is captured verbatim. */
function createCaptureStream(): { stream: Writable; output: () => string } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString("utf8"));
      callback();
    }
  });

  return { stream, output: () => chunks.join("") };
}

function capturingLogger(stream: Writable): FastifyServerOptions["logger"] {
  const base = createLoggerOptions("info") as Exclude<ReturnType<typeof createLoggerOptions>, boolean>;
  return { ...base, stream };
}

/** The one emitted line that carries the beacon's message, parsed as JSON. */
function reportedEvent(output: string): Record<string, unknown> | undefined {
  const line = output
    .split("\n")
    .find((entry) => entry.includes("wallet failure reported"));
  return line === undefined ? undefined : (JSON.parse(line) as Record<string, unknown>);
}

// pino's own envelope (level/time/pid/hostname/msg) plus Fastify's request id
// binding; everything outside it must be the closed vocabulary and nothing else.
const LOG_ENVELOPE = new Set(["level", "time", "pid", "hostname", "reqId", "msg", "v"]);

describe("POST /telemetry/wallet-failures", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("answers 401 without a token, before any body is considered", async () => {
    app = buildApp({ auth: { port: fakeAuthPort() } });

    const response = await app.inject({
      method: "POST",
      url: "/telemetry/wallet-failures",
      payload: { operation: "connect", outcome: "rejected" }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ code: "unauthenticated" });
  });

  it("accepts a valid event with 202 and logs exactly operation and outcome", async () => {
    const { stream, output } = createCaptureStream();
    app = buildApp({ auth: { port: fakeAuthPort() }, logger: capturingLogger(stream) });

    const response = await app.inject({
      method: "POST",
      url: "/telemetry/wallet-failures",
      headers: bearer("PYME"),
      payload: { operation: "sign_transaction", outcome: "network_mismatch" }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ accepted: true });

    const parsed = reportedEvent(output());
    expect(parsed).toBeDefined();
    expect(parsed!["operation"]).toBe("sign_transaction");
    expect(parsed!["outcome"]).toBe("network_mismatch");
    expect(parsed!["msg"]).toBe("wallet failure reported");
    // Nothing beyond the closed, text-free vocabulary crosses the boundary.
    expect(Object.keys(parsed!).filter((key) => !LOG_ENVELOPE.has(key)).sort()).toEqual([
      "operation",
      "outcome"
    ]);
  });

  it.each([
    ["a drifted extra key", { operation: "connect", outcome: "rejected", publicKey: "GAB" }],
    ["an unknown operation", { operation: "signTransaction", outcome: "rejected" }],
    ["an unknown outcome", { operation: "connect", outcome: "failed" }],
    ["a missing outcome", { operation: "connect" }],
    ["a missing operation", { outcome: "rejected" }],
    ["an empty body", {}]
  ])("answers 400 with no log for %s", async (_description, payload) => {
    const { stream, output } = createCaptureStream();
    app = buildApp({ auth: { port: fakeAuthPort() }, logger: capturingLogger(stream) });

    const response = await app.inject({
      method: "POST",
      url: "/telemetry/wallet-failures",
      headers: bearer("INVERSOR"),
      payload
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(reportedEvent(output())).toBeUndefined();
  });
});
