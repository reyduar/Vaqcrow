import { Writable } from "node:stream";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { Secret } from "../../application/config/secret.js";
import { createLoggerOptions } from "./logger-options.js";

/**
 * A logger that swallows nothing: each line pino writes is captured so the test
 * can assert on exactly what would have reached the log aggregator.
 */
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

describe("createLoggerOptions", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("honors the requested level", () => {
    const options = createLoggerOptions("debug") as { readonly level?: unknown };

    expect(options.level).toBe("debug");
  });

  it("redacts a sensitive object value and a JWT interpolated into the message", async () => {
    const { stream, output } = createCaptureStream();
    const baseOptions = createLoggerOptions("info") as Exclude<
      ReturnType<typeof createLoggerOptions>,
      boolean
    >;
    app = Fastify({ logger: { ...baseOptions, stream } });

    const rawKey = "service-role-key-RAW-value-1234567890";
    const rawJwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const hiddenSecret = "another-raw-secret-value";

    app.log.info(
      { authorization: rawKey, note: new Secret(hiddenSecret) },
      `incoming request token=${rawJwt}`
    );

    const written = output();
    expect(written).toContain("[redacted]");
    expect(written).not.toContain(rawKey);
    expect(written).not.toContain(rawJwt);
    expect(written).not.toContain(hiddenSecret);
  });
});
