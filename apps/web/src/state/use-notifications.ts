"use client";

import { useCallback } from "react";
import useSWR from "swr";
import type { NotificationItem, NotificationPort } from "@/application/ports/notification-port";

/**
 * Server state of the notification bell (Feature #382, Task #383 / T1d).
 *
 * The list and the unread count live in SWR, keyed once for the signed-in
 * principal; a port that is `null` (no backend configured) fetches nothing. The
 * copy comes verbatim from the API's catalogue — this hook only reorders the
 * cache.
 *
 * `markRead` and `markAllRead` write the cache optimistically and are rolled
 * back when the port answers a sanitized failure, so the badge never claims a
 * state the backend rejected. The functions resolve `true`/`false` instead of
 * throwing, because the bell has no per-row error surface in the template.
 */

export interface NotificationsState {
  readonly notifications: readonly NotificationItem[];
  readonly unread: number;
}

const EMPTY: NotificationsState = { notifications: [], unread: 0 };

/** Sanitized load/mutation failure; the code is already provider-free. */
class NotificationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`notifications request failed: ${code}`);
    this.name = "NotificationError";
    this.code = code;
  }
}

async function load(port: NotificationPort): Promise<NotificationsState> {
  const [list, count] = await Promise.all([port.list(), port.countUnread()]);
  if (!list.ok) throw new NotificationError(list.code);
  if (!count.ok) throw new NotificationError(count.code);
  return { notifications: [...list.notifications], unread: count.unread };
}

/** Marks one item read, decrementing the badge only when it was unread. */
function markOne(state: NotificationsState, id: string, readAt: string): NotificationsState {
  const target = state.notifications.find((item) => item.id === id);
  if (!target || target.readAt !== null) return state;
  return {
    notifications: state.notifications.map((item) => (item.id === id ? { ...item, readAt } : item)),
    unread: Math.max(0, state.unread - 1)
  };
}

/** Marks every unread item read and clears the badge. */
function markEvery(state: NotificationsState, readAt: string): NotificationsState {
  return {
    notifications: state.notifications.map((item) => (item.readAt === null ? { ...item, readAt } : item)),
    unread: 0
  };
}

export function useNotifications(port: NotificationPort | null) {
  const { data, error, isLoading, mutate } = useSWR<NotificationsState>(
    port ? "notifications" : null,
    () => load(port as NotificationPort),
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  const state = data ?? EMPTY;

  const markRead = useCallback(
    async (id: string): Promise<boolean> => {
      if (!port) return false;
      // The server's read route only matches an unread row (a replayed mark
      // would answer 404), so an already-read item is a no-op here rather than
      // a request that is guaranteed to be rejected.
      const target = data?.notifications.find((item) => item.id === id);
      if (!target || target.readAt !== null) return true;
      try {
        await mutate(
          async (current?: NotificationsState) => {
            const result = await port.markRead(id);
            if (!result.ok) throw new NotificationError(result.code);
            return current ? markOne(current, id, new Date().toISOString()) : current;
          },
          {
            optimisticData: (current?: NotificationsState) => markOne(current ?? EMPTY, id, new Date().toISOString()),
            rollbackOnError: true,
            revalidate: false
          }
        );
        return true;
      } catch {
        return false;
      }
    },
    [data, mutate, port]
  );

  const markAllRead = useCallback(async (): Promise<boolean> => {
    if (!port) return false;
    try {
      await mutate(
        async (current?: NotificationsState) => {
          const result = await port.markAllRead();
          if (!result.ok) throw new NotificationError(result.code);
          return current ? markEvery(current, new Date().toISOString()) : current;
        },
        {
          optimisticData: (current?: NotificationsState) => markEvery(current ?? EMPTY, new Date().toISOString()),
          rollbackOnError: true,
          revalidate: false
        }
      );
      return true;
    } catch {
      return false;
    }
  }, [mutate, port]);

  return {
    notifications: state.notifications,
    unread: state.unread,
    isLoading,
    loadFailed: error !== undefined,
    markRead,
    markAllRead
  };
}
