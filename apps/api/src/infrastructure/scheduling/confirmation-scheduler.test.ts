import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CorrelationId } from "@vaqcrow/contracts";
import { parseCorrelationId } from "@vaqcrow/contracts";
import type { ConfirmFundingIntentsResult } from "../../application/use-cases/confirm-funding-intents.js";
import { DEFAULT_CONFIRMATION_POLICY } from "../../application/use-cases/confirm-funding-intents.js";
import { ConfirmationScheduler } from "./confirmation-scheduler.js";

const NOW = "2026-09-21T12:00:00.000Z";
const INTERVAL_MS = 1_000;
const CORRELATION_ID = parseCorrelationId("22222222-2222-4222-8222-222222222222");

/**
 * The scheduler is driven through the use case's own ports, so every tick here
 * runs the real use case against a double. Counting `findPending` calls is
 * therefore counting ticks, and nothing about the loop is asserted through a
 * mock of the loop itself.
 */
function depsFor(options: { failFirstTick?: boolean } = {}) {
  let calls = 0;

  const findPending = vi.fn().mockImplementation(async () => {
    calls += 1;
    if (options.failFirstTick === true && calls === 1) {
      throw new Error("database unreachable");
    }
    return { ok: true, value: [] };
  });

  return {
    repository: {
      findPending,
      recordAttempt: vi.fn().mockResolvedValue({ ok: true, value: { record: {}, applied: true } }),
      recordConfirmation: vi.fn().mockResolvedValue({ ok: true, value: { record: {}, applied: true } })
    },
    transaction: { submit: vi.fn(), findTransaction: vi.fn() },
    findPending
  };
}

function schedulerFor(
  deps: ReturnType<typeof depsFor>,
  overrides: {
    intervalMs?: number;
    onStep?: (result: ConfirmFundingIntentsResult) => void;
    onError?: (error: unknown) => void;
    generateCorrelationId?: () => CorrelationId;
  } = {}
) {
  return new ConfirmationScheduler(deps, {
    intervalMs: overrides.intervalMs ?? INTERVAL_MS,
    policy: DEFAULT_CONFIRMATION_POLICY,
    now: () => NOW,
    generateCorrelationId: overrides.generateCorrelationId ?? (() => CORRELATION_ID),
    ...(overrides.onStep === undefined ? {} : { onStep: overrides.onStep }),
    ...(overrides.onError === undefined ? {} : { onError: overrides.onError })
  });
}

describe("ConfirmationScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing at all until it is started", async () => {
    const deps = depsFor();

    schedulerFor(deps);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 5);
    expect(deps.findPending).not.toHaveBeenCalled();
  });

  it("runs one tick per interval once started", async () => {
    const deps = depsFor();
    const scheduler = schedulerFor(deps);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3);

    expect(deps.findPending).toHaveBeenCalledTimes(3);
    await scheduler.stop();
  });

  it("asks the use case for the instant its own clock reports", async () => {
    const deps = depsFor();
    const scheduler = schedulerFor(deps);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);

    expect(deps.findPending).toHaveBeenCalledWith({
      now: NOW,
      limit: DEFAULT_CONFIRMATION_POLICY.batchSize
    });
    await scheduler.stop();
  });

  it("gives every tick its own correlation id, so an execution is traceable", async () => {
    const deps = depsFor();
    const generateCorrelationId = vi.fn(() => CORRELATION_ID);
    const scheduler = schedulerFor(deps, { generateCorrelationId });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 2);

    // DEMO.md §11 wants a visible correlation id per execution, and two ticks are
    // two executions — reusing one id would merge them in the timeline.
    expect(generateCorrelationId).toHaveBeenCalledTimes(2);
    await scheduler.stop();
  });

  it("is idempotent: starting twice does not double the ticks", async () => {
    const deps = depsFor();
    const scheduler = schedulerFor(deps);

    scheduler.start();
    scheduler.start();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);

    expect(deps.findPending).toHaveBeenCalledTimes(1);
    await scheduler.stop();
  });

  it("stops for good, and does not reschedule itself", async () => {
    const deps = depsFor();
    const scheduler = schedulerFor(deps);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    await scheduler.stop();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 5);

    expect(deps.findPending).toHaveBeenCalledTimes(1);
  });

  it("keeps running after a tick throws", async () => {
    const deps = depsFor({ failFirstTick: true });
    const scheduler = schedulerFor(deps);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3);

    // A scheduler that dies on one bad tick is worse than no scheduler: the
    // database being briefly unreachable is exactly when it must keep trying.
    expect(deps.findPending).toHaveBeenCalledTimes(3);
    await scheduler.stop();
  });

  it("never overlaps ticks, however slow one is", async () => {
    let release: (() => void) | undefined;
    const deps = depsFor();
    deps.findPending.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ ok: true, value: [] });
        })
    );
    const scheduler = schedulerFor(deps);

    scheduler.start();
    // The first tick is now parked inside `findPending`. The next timer is only
    // armed once a tick finishes, so time passing cannot start a second one.
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 4);
    expect(deps.findPending).toHaveBeenCalledTimes(1);

    release?.();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 2);
    expect(deps.findPending).toHaveBeenCalledTimes(2);

    // The second tick is parked on its own unresolved promise, and `stop()` waits
    // for the tick in flight — so it has to be released before the loop can end.
    release?.();
    await scheduler.stop();
  });

  it("waits for the tick in flight when it is stopped", async () => {
    let release: (() => void) | undefined;
    const deps = depsFor();
    deps.findPending.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ ok: true, value: [] });
        })
    );
    const scheduler = schedulerFor(deps);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);

    let stopped = false;
    const stopping = scheduler.stop().then(() => {
      stopped = true;
    });

    // `stop()` must not resolve while a tick is still writing: a shutdown that
    // returns early leaves a promise running against a closing process.
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(stopped).toBe(false);

    release?.();
    await stopping;
    expect(stopped).toBe(true);
  });

  it("reports a tick that could not run, rather than swallowing it silently", async () => {
    const deps = depsFor({ failFirstTick: true });
    const onError = vi.fn();
    const scheduler = schedulerFor(deps, { onError });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 2);

    // The loop survives either way, but a failure nobody hears about is
    // indistinguishable from a loop that is working.
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    await scheduler.stop();
  });

  it("hands each tick's result to the observer", async () => {
    const deps = depsFor();
    const onStep = vi.fn();
    const scheduler = schedulerFor(deps, { onStep });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);

    expect(onStep).toHaveBeenCalledWith({ ok: true, value: [] });
    await scheduler.stop();
  });

  it("exposes a single step that can be run without starting the loop", async () => {
    const deps = depsFor();
    const scheduler = schedulerFor(deps);

    const result = await scheduler.runOnce();

    expect(result).toEqual({ ok: true, value: [] });
    expect(deps.findPending).toHaveBeenCalledTimes(1);
    expect(scheduler.start).toBeDefined();
  });
});
