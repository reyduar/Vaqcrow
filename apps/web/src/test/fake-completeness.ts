/**
 * Test-only in-memory `CompletenessCheckPort`. No network, no timers.
 *
 * It mirrors the adapter's observable contract (a deterministic complete result
 * with no findings) and adds test controls the real adapter does not have —
 * `seedResult`, `failNext` and a held promise (`holdNextCheck`) so the loading
 * state is observable without fake timers.
 *
 * Not collected as a test suite: it has no `.test.` segment.
 */
import type {
  CompletenessCheckInput,
  CompletenessCheckPort,
  CompletenessCheckResult,
  CompletenessErrorCode,
  CompletenessFinding,
  CompletenessResult
} from "@/application/ports/completeness-check-port";

/** Builds a sanitized result with no findings, overridable per test. */
export function completenessResult(overrides: Partial<CompletenessResult> = {}): CompletenessResult {
  return { complete: true, findings: [], ...overrides };
}

/** A gap finding, as the API reports a shortfall. */
export function gapFinding(
  detail = "Falta un documento obligatorio: Estatuto.",
  code: CompletenessFinding["code"] = "missing_document"
): CompletenessFinding {
  return { code, severity: "gap", detail };
}

export class FakeCompleteness implements CompletenessCheckPort {
  /** Inputs passed to `check`, in order. */
  readonly calls: CompletenessCheckInput[] = [];

  private result: CompletenessCheckResult = { ok: true, result: completenessResult() };
  private readonly failures: CompletenessErrorCode[] = [];
  private held: Promise<void> | null = null;

  seedResult(result: CompletenessResult): void {
    this.result = { ok: true, result };
  }

  /** The next `check` call answers `{ ok: false, code }`. */
  failNext(code: CompletenessErrorCode = "unavailable"): void {
    this.failures.push(code);
  }

  /** Holds the next resolution until the returned release is called. */
  holdNextCheck(): () => void {
    let release!: () => void;
    this.held = new Promise<void>((resolve) => {
      release = resolve;
    });
    return release;
  }

  async check(input: CompletenessCheckInput): Promise<CompletenessCheckResult> {
    this.calls.push(input);
    const held = this.held;
    this.held = null;
    if (held) await held;
    const failure = this.failures.shift();
    if (failure) return { ok: false, code: failure };
    return this.result;
  }
}
