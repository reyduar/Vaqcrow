/**
 * Secret boundary for configuration values.
 *
 * A `Secret` wraps a sensitive string so it cannot leak by accident. The raw
 * value is reachable only through `reveal()`, which is greppable in review,
 * while string coercion and `JSON.stringify` collapse to a constant marker.
 * A server secret therefore cannot reach a log line, a serialised response or
 * a browser bundle through ordinary formatting — the leak has to be explicit
 * to happen at all.
 *
 * The `#value` private field is deliberately invisible to `util.inspect`, so
 * `console.log` of a whole config object prints `Secret {}` rather than the
 * credential.
 */

export const REDACTED_MARKER = "[redacted]";

export class Secret {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  /** Point of use: the only way to obtain the raw value. */
  reveal(): string {
    return this.#value;
  }

  toJSON(): string {
    return REDACTED_MARKER;
  }

  toString(): string {
    return REDACTED_MARKER;
  }
}

export function isSecret(value: unknown): value is Secret {
  return value instanceof Secret;
}
