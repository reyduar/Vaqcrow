import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { NotificationItem, NotificationPort } from "@/application/ports/notification-port";
import { useNotifications } from "./use-notifications";

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10",
    recipientUserId: "00000000-0000-4000-8000-000000000000",
    eventKey: "contribution:1",
    eventType: "investor.contribution_confirmed",
    title: "Tu aporte se confirmó",
    body: "Tu aporte quedó registrado en Stellar Testnet.",
    ctaLabel: "Ver mi portafolio",
    ctaHref: "/portfolio",
    readAt: null,
    createdAt: "2026-10-04T09:42:00.000Z",
    ...overrides
  };
}

const READ_ITEM = item({
  id: "9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d",
  eventKey: "goal:1",
  title: "La campaña alcanzó la meta",
  readAt: "2026-10-04T08:00:00.000Z"
});

function fakePort(unread = 1) {
  const list = vi.fn().mockResolvedValue({ ok: true, notifications: [item(), READ_ITEM] });
  const countUnread = vi.fn().mockResolvedValue({ ok: true, unread });
  const markRead = vi.fn().mockResolvedValue({ ok: true });
  const markAllRead = vi.fn().mockResolvedValue({ ok: true, updated: unread });
  const port: NotificationPort = { list, countUnread, markRead, markAllRead };
  return { port, list, countUnread, markRead, markAllRead };
}

describe("useNotifications", () => {
  it("loads the list and the unread count through the port", async () => {
    const { port, list, countUnread } = fakePort();

    const { result } = renderHook(() => useNotifications(port), { wrapper });

    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
    expect(list).toHaveBeenCalledTimes(1);
    expect(countUnread).toHaveBeenCalledTimes(1);
    expect(result.current.unread).toBe(1);
    expect(result.current.loadFailed).toBe(false);
  });

  it("fetches nothing and reports no data with a null port", async () => {
    const { result } = renderHook(() => useNotifications(null), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unread).toBe(0);
    expect(result.current.loadFailed).toBe(false);
  });

  it("marks one read optimistically and decrements the badge", async () => {
    const { port, markRead } = fakePort();
    const { result } = renderHook(() => useNotifications(port), { wrapper });
    await waitFor(() => expect(result.current.unread).toBe(1));

    await act(async () => {
      expect(await result.current.markRead(item().id)).toBe(true);
    });

    expect(markRead).toHaveBeenCalledWith(item().id);
    expect(result.current.unread).toBe(0);
    expect(result.current.notifications.find((entry) => entry.id === item().id)?.readAt).not.toBeNull();
  });

  it("does not call the port for an item that is already read", async () => {
    const { port, markRead } = fakePort();
    const { result } = renderHook(() => useNotifications(port), { wrapper });
    await waitFor(() => expect(result.current.unread).toBe(1));

    await act(async () => {
      expect(await result.current.markRead(READ_ITEM.id)).toBe(true);
    });

    expect(markRead).not.toHaveBeenCalled();
    expect(result.current.unread).toBe(1);
  });

  it("marks every unread item read and clears the badge", async () => {
    const { port, markAllRead } = fakePort();
    const { result } = renderHook(() => useNotifications(port), { wrapper });
    await waitFor(() => expect(result.current.unread).toBe(1));

    await act(async () => {
      expect(await result.current.markAllRead()).toBe(true);
    });

    expect(markAllRead).toHaveBeenCalledTimes(1);
    expect(result.current.unread).toBe(0);
    expect(result.current.notifications.every((entry) => entry.readAt !== null)).toBe(true);
  });

  it("rolls back the optimistic change when marking one fails", async () => {
    const { port, markRead } = fakePort();
    markRead.mockResolvedValueOnce({ ok: false, code: "not_found" });
    const { result } = renderHook(() => useNotifications(port), { wrapper });
    await waitFor(() => expect(result.current.unread).toBe(1));

    await act(async () => {
      expect(await result.current.markRead(item().id)).toBe(false);
    });

    expect(result.current.unread).toBe(1);
    expect(result.current.notifications.find((entry) => entry.id === item().id)?.readAt).toBeNull();
  });

  it("reports a load failure without inventing data", async () => {
    const port: NotificationPort = {
      list: vi.fn().mockResolvedValue({ ok: false, code: "network" }),
      countUnread: vi.fn().mockResolvedValue({ ok: true, unread: 0 }),
      markRead: vi.fn().mockResolvedValue({ ok: false, code: "unavailable" }),
      markAllRead: vi.fn().mockResolvedValue({ ok: false, code: "unavailable" })
    };

    const { result } = renderHook(() => useNotifications(port), { wrapper });

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unread).toBe(0);
  });
});
