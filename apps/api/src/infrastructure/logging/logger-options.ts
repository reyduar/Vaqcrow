import type { FastifyServerOptions } from "fastify";
import type { LogLevel } from "../../application/config/api-config.js";
import { redactForLog } from "../../application/config/redaction.js";

/**
 * The logger options Fastify is built with (#31/WU1). A plain pino options
 * object — Fastify forwards it (including `hooks` and any caller-supplied
 * `stream`) straight to its bundled pino, so no `pino` dependency is added.
 *
 * `redactForLog` runs in `hooks.logMethod`, which pino invokes with every log
 * call's arguments *before* the line is written. That single seam covers both
 * nets: a `Secret` or a sensitive-keyed value inside an object, and a token
 * interpolated into a message string. Nothing is logged through this logger
 * without crossing the boundary first.
 */
export function createLoggerOptions(level: LogLevel): FastifyServerOptions["logger"] {
  return {
    level,
    hooks: {
      logMethod(args, method) {
        // `args` is a pino overload tuple; mapping it widens to `unknown[]`, so
        // it is cast back to delegate. Semantics are unchanged: every argument,
        // message included, crosses `redactForLog` before the line is written.
        return method.apply(
          this,
          args.map((arg) => redactForLog(arg)) as Parameters<typeof method>
        );
      }
    }
  };
}
