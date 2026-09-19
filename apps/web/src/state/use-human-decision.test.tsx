import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { HumanDecisionGateway } from "@/application/ports/human-decision-gateway";
import { useHumanDecision } from "./use-human-decision";

const APPLICATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_1 = "11111111-1111-4111-8111-111111111111";
const ID_2 = "22222222-2222-4222-8222-222222222222";
const input = { outcome: "rejected", actor: "op", reason: "no", approvedLimitArs: null } as const;

function recordFor(decisionId: string) {
  return {
    decisionId,
    applicationId: APPLICATION_ID,
    ...input,
    decidedAt: "2026-09-19T12:00:00.000Z",
    correlationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  };
}

function ids(...values: string[]) {
  const queue = [...values];
  return vi.fn(() => queue.shift() ?? "33333333-3333-4333-8333-333333333333");
}

describe("useHumanDecision", () => {
  it("records a decision and exposes the server record", async () => {
    const record = vi.fn().mockResolvedValue({ applied: true, decision: recordFor(ID_1) });
    const generate = ids(ID_1);
    const { result } = renderHook(() => useHumanDecision({ record }, APPLICATION_ID, generate));

    await act(() => result.current.submit(input));

    expect(result.current.recorded).toEqual({ applied: true, decision: recordFor(ID_1) });
    expect(result.current.error).toBeUndefined();
    expect(result.current.isSubmitting).toBe(false);
  });

  it("reuses the decision id when retrying the same payload after a network failure", async () => {
    const record = vi
      .fn()
      .mockRejectedValueOnce(new HttpClientError("network"))
      .mockResolvedValueOnce({ applied: false, decision: recordFor(ID_1) });
    const generate = ids(ID_1, ID_2);
    const { result } = renderHook(() => useHumanDecision({ record }, APPLICATION_ID, generate));

    await act(() => result.current.submit(input));
    expect(result.current.error?.kind).toBe("network");
    expect(result.current.recorded).toBeUndefined();

    await act(() => result.current.submit(input));
    expect(record.mock.calls[0]![0].decisionId).toBe(ID_1);
    expect(record.mock.calls[1]![0].decisionId).toBe(ID_1);
    expect(result.current.recorded?.applied).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it("uses a new decision id when the payload changed between attempts", async () => {
    const record = vi.fn().mockRejectedValue(new HttpClientError("http", 503, undefined, "unavailable"));
    const generate = ids(ID_1, ID_2);
    const { result } = renderHook(() => useHumanDecision({ record }, APPLICATION_ID, generate));

    await act(() => result.current.submit(input));
    await act(() => result.current.submit({ ...input, reason: "different reason" }));

    expect(record.mock.calls[0]![0].decisionId).toBe(ID_1);
    expect(record.mock.calls[1]![0].decisionId).toBe(ID_2);
  });

  it("surfaces a state conflict without recording anything", async () => {
    const record = vi.fn().mockRejectedValue(new HttpClientError("http", 409, undefined, "state_conflict"));
    const generate = ids(ID_1);
    const { result } = renderHook(() => useHumanDecision({ record }, APPLICATION_ID, generate));

    await act(() => result.current.submit(input));

    expect(result.current.error?.kind).toBe("state_conflict");
    expect(result.current.recorded).toBeUndefined();
  });

  it("fails explicitly, without pretending, when no gateway is configured", async () => {
    const { result } = renderHook(() => useHumanDecision(null, APPLICATION_ID, ids(ID_1)));

    await act(() => result.current.submit(input));

    expect(result.current.error?.kind).toBe("unavailable");
    expect(result.current.recorded).toBeUndefined();
  });

  it("ignores a second submit while one is in flight", async () => {
    let resolve!: (value: unknown) => void;
    const record = vi.fn().mockReturnValue(new Promise((r) => (resolve = r)));
    const generate = ids(ID_1);
    const { result } = renderHook(() =>
      useHumanDecision({ record } as HumanDecisionGateway, APPLICATION_ID, generate)
    );

    let first!: Promise<void>;
    act(() => {
      first = result.current.submit(input);
      void result.current.submit(input);
    });
    expect(record).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve({ applied: true, decision: recordFor(ID_1) });
      await first;
    });
    expect(result.current.recorded?.applied).toBe(true);
  });
});
