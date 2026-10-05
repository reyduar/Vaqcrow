import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NewNotification } from "../../application/ports/notification-repository-port.js";
import { SupabaseNotificationRepository } from "./supabase-notification-repository.js";

const ADMIN = "00000000-0000-4000-8000-000000000001";
const PYME = "00000000-0000-4000-8000-000000000002";
const NOTIFICATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const NEW_NOTIFICATION: NewNotification = {
  recipientUserId: ADMIN,
  eventKey: "application:11111111-1111-4111-8111-111111111111:submitted",
  eventType: "admin.new_application",
  title: "Nueva solicitud: Panadería Horizonte SRL",
  body: "Panadería Horizonte SRL envió su solicitud a revisión.",
  ctaLabel: "Revisar solicitud",
  ctaHref: "/admin"
};

const STORED_ROW = {
  id: NOTIFICATION_ID,
  recipient_user_id: ADMIN,
  event_key: NEW_NOTIFICATION.eventKey,
  event_type: NEW_NOTIFICATION.eventType,
  title: NEW_NOTIFICATION.title,
  body: NEW_NOTIFICATION.body,
  cta_label: "Revisar solicitud",
  cta_href: "/admin",
  read_at: null,
  created_at: "2026-10-04T12:00:00.000Z"
};

interface DbResult {
  readonly data?: unknown;
  readonly error?: unknown;
  readonly count?: number | null;
}

interface Filter {
  readonly column: string;
  readonly value: unknown;
}

interface Op {
  table: string;
  action: "select" | "insert" | "upsert" | "update";
  columns?: string | undefined;
  selectOptions?: { readonly count?: string | undefined; readonly head?: boolean | undefined };
  payload?: unknown;
  upsertOptions?: unknown;
  filters: Filter[];
  order?: { readonly column: string; readonly options: unknown };
  terminal?: "single" | "maybeSingle";
}

type Handler = (op: Op) => DbResult | Promise<DbResult>;
type ListUsersHandler = (params: {
  page: number;
  perPage: number;
}) => { data: { users: Array<{ id: string; email?: string }> }; error?: unknown };

/**
 * A hand-written structural client: no network, no Supabase. `.upsert`/`.update`
 * builders resolve through `then` (they are awaited directly); `.single` and
 * `.maybeSingle` are the explicit terminal calls. `auth.admin.listUsers` models
 * the one Auth Admin read the adapter needs.
 */
function fakeClient(handler: Handler, listUsers?: ListUsersHandler) {
  const ops: Op[] = [];
  const userCalls: Array<{ page: number; perPage: number }> = [];

  const makeBuilder = (op: Op) => {
    const run = (): Promise<DbResult> => {
      try {
        return Promise.resolve(handler(op));
      } catch (error) {
        return Promise.reject(error);
      }
    };

    const builder = {
      select(columns?: string, options?: { count?: string; head?: boolean }) {
        op.columns = columns;
        if (options !== undefined) {
          op.selectOptions = options;
        }
        return builder;
      },
      insert(payload: unknown) {
        op.action = "insert";
        op.payload = payload;
        return builder;
      },
      upsert(payload: unknown, options?: unknown) {
        op.action = "upsert";
        op.payload = payload;
        op.upsertOptions = options;
        return builder;
      },
      update(payload: unknown) {
        op.action = "update";
        op.payload = payload;
        return builder;
      },
      eq(column: string, value: unknown) {
        op.filters.push({ column, value });
        return builder;
      },
      is(column: string, value: unknown) {
        op.filters.push({ column, value });
        return builder;
      },
      order(column: string, options: unknown) {
        op.order = { column, options };
        return builder;
      },
      single() {
        op.terminal = "single";
        return run();
      },
      maybeSingle() {
        op.terminal = "maybeSingle";
        return run();
      },
      then(onFulfilled: (value: DbResult) => unknown, onRejected: (reason: unknown) => unknown) {
        return run().then(onFulfilled, onRejected);
      }
    };
    return builder;
  };

  const client = {
    from(table: string) {
      const op: Op = { table, action: "select", filters: [] };
      ops.push(op);
      return makeBuilder(op);
    },
    auth: {
      admin: {
        listUsers(params: { page: number; perPage: number }) {
          userCalls.push(params);
          return Promise.resolve(listUsers ? listUsers(params) : { data: { users: [] }, error: null });
        }
      }
    }
  } as unknown as SupabaseClient;

  return { client, ops, userCalls };
}

/** A provider error whose fields a caller must never see. */
const pgError = (code: string) => ({
  code,
  message: "SECRET message",
  details: "SECRET details",
  hint: "SECRET hint"
});

const noSecret = (value: unknown) => {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain("SECRET message");
  expect(serialized).not.toContain("SECRET details");
  expect(serialized).not.toContain("SECRET hint");
};

afterEach(() => vi.restoreAllMocks());

describe("SupabaseNotificationRepository.resolveRecipientsByRole", () => {
  it("resolves the active profiles of a role and joins their Auth emails", async () => {
    const { client, ops, userCalls } = fakeClient(
      (op) => (op.table === "profile" ? { data: [{ user_id: ADMIN }, { user_id: PYME }], error: null } : { data: null, error: null }),
      () => ({
        data: {
          users: [
            { id: ADMIN, email: "admin@example.test" },
            { id: PYME, email: "pyme@example.test" },
            { id: "other", email: "other@example.test" }
          ]
        },
        error: null
      })
    );

    const result = await new SupabaseNotificationRepository(client).resolveRecipientsByRole("ADMIN");

    expect(result).toEqual({
      ok: true,
      recipients: [
        { userId: ADMIN, email: "admin@example.test" },
        { userId: PYME, email: "pyme@example.test" }
      ]
    });
    expect(ops[0]?.table).toBe("profile");
    expect(ops[0]?.columns).toBe("user_id");
    expect(ops[0]?.filters).toEqual([
      { column: "role", value: "ADMIN" },
      { column: "status", value: "active" }
    ]);
    expect(userCalls).toEqual([{ page: 1, perPage: 200 }]);
  });

  it("paginates the Auth user listing and drops profiles without an email", async () => {
    const pageOne = Array.from({ length: 200 }, (_v, index) => ({ id: `u${index}`, email: `u${index}@example.test` }));
    const { client, userCalls } = fakeClient(
      () => ({ data: [{ user_id: ADMIN }], error: null }),
      (params) => (params.page === 1 ? { data: { users: pageOne }, error: null } : { data: { users: [{ id: ADMIN }] }, error: null })
    );

    const result = await new SupabaseNotificationRepository(client).resolveRecipientsByRole("ADMIN");

    expect(userCalls).toEqual([
      { page: 1, perPage: 200 },
      { page: 2, perPage: 200 }
    ]);
    expect(result).toEqual({ ok: true, recipients: [] });
  });

  it("reports unavailable when the Auth listing exhausts its page cap with a full last page", async () => {
    const fullPage = Array.from({ length: 200 }, (_v, index) => ({ id: `u${index}`, email: `u${index}@example.test` }));
    const { client, userCalls } = fakeClient(
      () => ({ data: [{ user_id: ADMIN }], error: null }),
      () => ({ data: { users: fullPage }, error: null })
    );

    const result = await new SupabaseNotificationRepository(client).resolveRecipientsByRole("ADMIN");

    // A full page at the cap means there may be recipients beyond it, so a
    // partial map must not be returned as if it were complete.
    expect(result).toEqual({ ok: false, code: "unavailable" });
    expect(userCalls).toHaveLength(50);
  });

  it("returns no recipients without listing Auth users when the role has no active profile", async () => {
    const { client, userCalls } = fakeClient(() => ({ data: [], error: null }));

    expect(await new SupabaseNotificationRepository(client).resolveRecipientsByRole("PYME")).toEqual({
      ok: true,
      recipients: []
    });
    expect(userCalls).toEqual([]);
  });

  it("reports unavailable and sanitizes a profile error, a listing error or a throw", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const scenario of ["profile-error", "list-error", "throw"] as const) {
      const { client } = fakeClient(
        (op) => {
          if (scenario === "throw") {
            throw new Error("network SECRET");
          }
          return op.table === "profile" ? { data: null, error: pgError("42501") } : { data: [], error: null };
        },
        () => (scenario === "list-error" ? { data: { users: [] }, error: pgError("503") } : { data: { users: [] }, error: null })
      );

      const result = await new SupabaseNotificationRepository(client).resolveRecipientsByRole("ADMIN");

      expect(result).toEqual({ ok: false, code: "unavailable" });
      noSecret(result);
    }
  });

  it("skips a malformed profile row instead of returning a half-built recipient", async () => {
    const { client } = fakeClient(
      () => ({ data: [{ user_id: 42 }, { user_id: ADMIN }], error: null }),
      () => ({ data: { users: [{ id: ADMIN, email: "admin@example.test" }] }, error: null })
    );

    expect(await new SupabaseNotificationRepository(client).resolveRecipientsByRole("ADMIN")).toEqual({
      ok: true,
      recipients: [{ userId: ADMIN, email: "admin@example.test" }]
    });
  });
});

describe("SupabaseNotificationRepository.insertIfAbsent", () => {
  it("inserts with the idempotency key and returns the new row id", async () => {
    const { client, ops } = fakeClient((op) =>
      op.action === "upsert" ? { data: [{ id: NOTIFICATION_ID }], error: null } : { data: null, error: null }
    );

    const result = await new SupabaseNotificationRepository(client).insertIfAbsent(NEW_NOTIFICATION);

    expect(result).toEqual({ ok: true, inserted: true, id: NOTIFICATION_ID });
    expect(ops[0]?.action).toBe("upsert");
    expect(ops[0]?.upsertOptions).toEqual({
      onConflict: "event_key,recipient_user_id",
      ignoreDuplicates: true
    });
    expect(ops[0]?.payload).toEqual({
      recipient_user_id: ADMIN,
      event_key: NEW_NOTIFICATION.eventKey,
      event_type: "admin.new_application",
      title: NEW_NOTIFICATION.title,
      body: NEW_NOTIFICATION.body,
      cta_label: "Revisar solicitud",
      cta_href: "/admin"
    });
  });

  it("reports inserted=false and reads back the existing row on a conflict", async () => {
    const { client, ops } = fakeClient((op) => {
      if (op.action === "upsert") {
        return { data: [], error: null };
      }
      if (op.action === "select" && op.terminal === "maybeSingle") {
        return { data: { id: NOTIFICATION_ID }, error: null };
      }
      return { data: null, error: null };
    });

    const result = await new SupabaseNotificationRepository(client).insertIfAbsent(NEW_NOTIFICATION);

    expect(result).toEqual({ ok: true, inserted: false, id: NOTIFICATION_ID });
    const readBack = ops[1];
    expect(readBack?.table).toBe("notification");
    expect(readBack?.terminal).toBe("maybeSingle");
    expect(readBack?.filters).toEqual([
      { column: "event_key", value: NEW_NOTIFICATION.eventKey },
      { column: "recipient_user_id", value: ADMIN }
    ]);
  });

  it("reports unavailable when the conflict read-back fails or throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const readBackFailure = fakeClient((op) =>
      op.action === "upsert" ? { data: [], error: null } : { data: null, error: pgError("42501") }
    );
    expect(await new SupabaseNotificationRepository(readBackFailure.client).insertIfAbsent(NEW_NOTIFICATION)).toEqual({
      ok: false,
      code: "unavailable"
    });

    const thrown = fakeClient(() => {
      throw new Error("socket SECRET");
    });
    expect(await new SupabaseNotificationRepository(thrown.client).insertIfAbsent(NEW_NOTIFICATION)).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("reports unavailable and never leaks the provider error on an insert failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient((op) => (op.action === "upsert" ? { data: null, error: pgError("23505") } : { data: null, error: null }));

    const result = await new SupabaseNotificationRepository(client).insertIfAbsent(NEW_NOTIFICATION);

    expect(result).toEqual({ ok: false, code: "unavailable" });
    noSecret(result);
  });
});

describe("SupabaseNotificationRepository.markEmailSent", () => {
  it("stamps email_sent_at on the notification", async () => {
    const { client, ops } = fakeClient(() => ({ error: null }));

    await new SupabaseNotificationRepository(client).markEmailSent(NOTIFICATION_ID, "2026-10-04T12:00:05.000Z");

    expect(ops[0]?.action).toBe("update");
    expect(ops[0]?.payload).toEqual({ email_sent_at: "2026-10-04T12:00:05.000Z" });
    expect(ops[0]?.filters).toEqual([{ column: "id", value: NOTIFICATION_ID }]);
  });

  it("never throws on a provider error or a throw", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const errored = fakeClient(() => ({ error: pgError("42501") }));
    await expect(
      new SupabaseNotificationRepository(errored.client).markEmailSent(NOTIFICATION_ID, "2026-10-04T12:00:05.000Z")
    ).resolves.toBeUndefined();

    const thrown = fakeClient(() => {
      throw new Error("network SECRET");
    });
    await expect(
      new SupabaseNotificationRepository(thrown.client).markEmailSent(NOTIFICATION_ID, "2026-10-04T12:00:05.000Z")
    ).resolves.toBeUndefined();
  });
});

describe("SupabaseNotificationRepository.listByRecipient", () => {
  it("list the recipient's notifications newest first and maps every field", async () => {
    const { client, ops } = fakeClient(() => ({ data: [STORED_ROW], error: null }));

    const result = await new SupabaseNotificationRepository(client).listByRecipient(ADMIN);

    expect(result).toEqual({
      ok: true,
      notifications: [
        {
          id: NOTIFICATION_ID,
          recipientUserId: ADMIN,
          eventKey: NEW_NOTIFICATION.eventKey,
          eventType: "admin.new_application",
          title: NEW_NOTIFICATION.title,
          body: NEW_NOTIFICATION.body,
          ctaLabel: "Revisar solicitud",
          ctaHref: "/admin",
          readAt: null,
          createdAt: "2026-10-04T12:00:00.000Z"
        }
      ]
    });
    expect(ops[0]?.filters).toEqual([{ column: "recipient_user_id", value: ADMIN }]);
    expect(ops[0]?.order).toEqual({ column: "created_at", options: { ascending: false } });
  });

  it("reads a null cta as null and skips a malformed row", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const validWithNullCta = { ...STORED_ROW, cta_label: null, cta_href: null };
    const malformed = { ...STORED_ROW, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", created_at: null };
    const { client } = fakeClient(() => ({ data: [validWithNullCta, malformed], error: null }));

    const result = await new SupabaseNotificationRepository(client).listByRecipient(ADMIN);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]).toMatchObject({ id: NOTIFICATION_ID, ctaLabel: null, ctaHref: null });
  });

  it("reports unavailable on a provider error or a throw, without leaking it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const errored = fakeClient(() => ({ data: null, error: pgError("XX000") }));
    const erroredResult = await new SupabaseNotificationRepository(errored.client).listByRecipient(ADMIN);
    expect(erroredResult).toEqual({ ok: false, code: "unavailable" });
    noSecret(erroredResult);

    const thrown = fakeClient(() => {
      throw new Error("network SECRET");
    });
    expect(await new SupabaseNotificationRepository(thrown.client).listByRecipient(ADMIN)).toEqual({
      ok: false,
      code: "unavailable"
    });
  });
});

describe("SupabaseNotificationRepository.countUnread", () => {
  it("counts the recipient's unread rows with an exact head count", async () => {
    const { client, ops } = fakeClient(() => ({ count: 3, error: null }));

    expect(await new SupabaseNotificationRepository(client).countUnread(ADMIN)).toEqual({ ok: true, unread: 3 });
    expect(ops[0]?.selectOptions).toEqual({ count: "exact", head: true });
    expect(ops[0]?.filters).toEqual([
      { column: "recipient_user_id", value: ADMIN },
      { column: "read_at", value: null }
    ]);
  });

  it("reports unavailable on an error or a throw, and a null count as zero", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const errored = fakeClient(() => ({ count: null, error: pgError("42501") }));
    expect(await new SupabaseNotificationRepository(errored.client).countUnread(ADMIN)).toEqual({
      ok: false,
      code: "unavailable"
    });

    const nullCount = fakeClient(() => ({ count: null, error: null }));
    expect(await new SupabaseNotificationRepository(nullCount.client).countUnread(ADMIN)).toEqual({
      ok: true,
      unread: 0
    });

    const thrown = fakeClient(() => {
      throw new Error("network SECRET");
    });
    expect(await new SupabaseNotificationRepository(thrown.client).countUnread(ADMIN)).toEqual({
      ok: false,
      code: "unavailable"
    });
  });
});

describe("SupabaseNotificationRepository.markRead", () => {
  it("marks one owned, unread row read and reports the change", async () => {
    const { client, ops } = fakeClient(() => ({ data: [{ id: NOTIFICATION_ID }], error: null }));

    expect(await new SupabaseNotificationRepository(client).markRead(ADMIN, NOTIFICATION_ID)).toEqual({
      ok: true,
      changed: true
    });

    expect(ops[0]?.action).toBe("update");
    const payload = ops[0]?.payload as { read_at?: unknown };
    expect(typeof payload.read_at).toBe("string");
    expect(Number.isNaN(Date.parse(payload.read_at as string))).toBe(false);
    expect(ops[0]?.filters).toEqual([
      { column: "id", value: NOTIFICATION_ID },
      { column: "recipient_user_id", value: ADMIN },
      { column: "read_at", value: null }
    ]);
  });

  it("reports changed=false when no owned unread row changed", async () => {
    const { client } = fakeClient(() => ({ data: [], error: null }));
    expect(await new SupabaseNotificationRepository(client).markRead(ADMIN, NOTIFICATION_ID)).toEqual({
      ok: true,
      changed: false
    });
  });

  it("reports unavailable on an error or a throw, never leaking the provider error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const errored = fakeClient(() => ({ data: null, error: pgError("42501") }));
    expect(await new SupabaseNotificationRepository(errored.client).markRead(ADMIN, NOTIFICATION_ID)).toEqual({
      ok: false,
      code: "unavailable"
    });

    const thrown = fakeClient(() => {
      throw new Error("network SECRET");
    });
    expect(await new SupabaseNotificationRepository(thrown.client).markRead(ADMIN, NOTIFICATION_ID)).toEqual({
      ok: false,
      code: "unavailable"
    });
  });
});

describe("SupabaseNotificationRepository.markAllRead", () => {
  it("marks every unread owned row read and returns the count", async () => {
    const { client, ops } = fakeClient(() => ({ data: [{ id: "a" }, { id: "b" }], error: null }));

    expect(await new SupabaseNotificationRepository(client).markAllRead(ADMIN)).toEqual({ ok: true, updated: 2 });
    expect(ops[0]?.action).toBe("update");
    expect(ops[0]?.filters).toEqual([
      { column: "recipient_user_id", value: ADMIN },
      { column: "read_at", value: null }
    ]);
  });

  it("reports unavailable on an error or a throw", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const errored = fakeClient(() => ({ data: null, error: pgError("42501") }));
    expect(await new SupabaseNotificationRepository(errored.client).markAllRead(ADMIN)).toEqual({
      ok: false,
      code: "unavailable"
    });

    const thrown = fakeClient(() => {
      throw new Error("network SECRET");
    });
    expect(await new SupabaseNotificationRepository(thrown.client).markAllRead(ADMIN)).toEqual({
      ok: false,
      code: "unavailable"
    });
  });
});
