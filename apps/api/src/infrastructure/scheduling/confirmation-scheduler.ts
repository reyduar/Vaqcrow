import { generateCorrelationId as createCorrelationId } from "@vaqcrow/contracts";
import type { CorrelationId } from "@vaqcrow/contracts";
import { confirmFundingIntents } from "../../application/use-cases/confirm-funding-intents.js";
import type {
  ConfirmFundingIntentsDeps,
  ConfirmFundingIntentsResult,
  ConfirmationPolicy
} from "../../application/use-cases/confirm-funding-intents.js";

/**
 * Drives the confirmation use case on a timer inside the API process.
 *
 * **Why there is no `apps/worker`.** `DEMO.md` line 150 makes a separate worker
 * conditional — "se agrega únicamente si las confirmaciones o jobs acotados no
 * caben de forma segura en el proceso de la API" — and line 318 lists it as *cut*
 * work when the durable poll fits the API. It does: "bounded and resumable"
 * forces the polling state to be persisted wherever the loop lives, so a separate
 * process would buy isolation rather than capability, at the cost of a fourth
 * workspace, its boundary rules, a deploy target and CI wiring. What makes that
 * safe is that this loop holds **no state at all** — the schedule lives in
 * `next_attempt_at` — so losing the process loses nothing, and the next one
 * resumes from the same table.
 *
 * **Why a recursive `setTimeout` rather than `setInterval`.** `setInterval` fires
 * on a fixed cadence regardless of whether the previous tick finished, so a slow
 * Horizon call would let ticks pile up and multiply the load exactly when the
 * network is already struggling. Here the next timer is armed only once a tick
 * completes, which makes overlap impossible by construction rather than by a
 * guard that has to be remembered.
 */

export interface ConfirmationSchedulerOptions {
  /**
   * How long to wait between the end of one tick and the start of the next.
   * Defaults to {@link DEFAULT_CONFIRMATION_INTERVAL_MS}.
   */
  readonly intervalMs?: number;
  readonly policy: ConfirmationPolicy;
  /** Injected so a test can decide what "now" means. */
  readonly now?: () => string;
  /** Injected so a test can assert one id per execution. */
  readonly generateCorrelationId?: () => CorrelationId;
  /**
   * Called with each tick's result. The default is to say nothing: a scheduler
   * that logs on its own would decide the log's shape, and the caller is the one
   * that knows what the demo's timeline needs.
   */
  readonly onStep?: (result: ConfirmFundingIntentsResult) => void;
  /**
   * Called when a tick could not run at all — an unreachable database, most
   * likely.
   *
   * The loop keeps going either way, but a swallowed failure with no observer is
   * indistinguishable from a loop that is working, which is the one thing an
   * operator cannot afford during a demo.
   */
  readonly onError?: (error: unknown) => void;
}

/**
 * How often the loop wakes.
 *
 * Testnet closes a ledger roughly every five seconds, so waking on that cadence
 * means a confirmation is noticed about as soon as it can exist — and the loop
 * itself costs nothing when there is nothing to confirm, because an empty tick is
 * one indexed query.
 */
export const DEFAULT_CONFIRMATION_INTERVAL_MS = 5_000;

export class ConfirmationScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<void> | undefined;
  private stopped = true;

  private readonly now: () => string;
  private readonly generateCorrelationId: () => CorrelationId;
  private readonly intervalMs: number;

  constructor(
    private readonly deps: ConfirmFundingIntentsDeps,
    private readonly options: ConfirmationSchedulerOptions
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.generateCorrelationId = options.generateCorrelationId ?? createCorrelationId;
    this.intervalMs = options.intervalMs ?? DEFAULT_CONFIRMATION_INTERVAL_MS;
  }

  /** Idempotent: starting an already-running scheduler is a no-op, not a second loop. */
  start(): void {
    if (!this.stopped) {
      return;
    }

    this.stopped = false;
    this.schedule();
  }

  /**
   * Stops the loop and waits for the tick in flight, if any.
   *
   * The wait is the point. A shutdown that returns while a tick is still writing
   * leaves a promise running against a closing process — which is exactly the
   * kind of thing that turns a clean restart into an intermittent failure.
   */
  async stop(): Promise<void> {
    this.stopped = true;

    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    await this.inFlight;
  }

  /**
   * Runs exactly one tick, without touching the loop.
   *
   * Exposed because a single step is genuinely useful outside the schedule — an
   * operational nudge, or a test that wants one deterministic step.
   */
  async runOnce(): Promise<ConfirmFundingIntentsResult> {
    return confirmFundingIntents(this.deps, {
      now: this.now(),
      // One id per execution: every write a tick causes belongs to that tick.
      correlationId: this.generateCorrelationId(),
      policy: this.options.policy
    });
  }

  private schedule(): void {
    if (this.stopped) {
      return;
    }

    this.timer = setTimeout(() => {
      void this.tick();
    }, this.intervalMs);

    // Never hold the process open on the timer's account: the HTTP server does
    // that, and a scheduler that keeps a test runner alive would be a bug.
    this.timer.unref?.();
  }

  private async tick(): Promise<void> {
    if (this.stopped) {
      return;
    }

    this.inFlight = this.run();
    await this.inFlight;
  }

  private async run(): Promise<void> {
    try {
      // The step runs first and is reported second, and the order is load-bearing
      // rather than stylistic. `this.options.onStep?.(await this.runOnce())` reads
      // as the same thing and is not: an optional call short-circuits the
      // evaluation of its **arguments**, so with no observer registered the step
      // would never run at all — the scheduler would tick forever doing nothing,
      // and every test that registers an observer would still pass.
      const result = await this.runOnce();

      this.options.onStep?.(result);
    } catch (error) {
      // The loop survives, but the failure is not silent: a tick that cannot run
      // at all is usually the database or Horizon being briefly unreachable —
      // precisely when the loop must keep going, and precisely when an operator
      // needs to know it is happening. Per-intent outcomes travel through
      // `onStep` instead, because those are not failures of the tick.
      this.options.onError?.(error);
    } finally {
      this.inFlight = undefined;
      // Re-armed here rather than on a fixed cadence, which is what makes
      // overlap impossible.
      this.schedule();
    }
  }
}
