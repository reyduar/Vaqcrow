import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PymeDocumentInput } from "../../application/ports/pyme-document-repository-port.js";
import { SupabasePymeDocumentRepository } from "./supabase-pyme-document-repository.js";

const OWNER = "00000000-0000-4000-8000-000000000004";
const DOCUMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OBJECT_PATH = `${OWNER}/cuit/aaaa-cuit.pdf`;
const CREATED_AT = "2026-10-05T19:00:00.000Z";

const INPUT: PymeDocumentInput = {
  ownerUserId: OWNER,
  kind: "cuit",
  objectPath: OBJECT_PATH,
  name: "cuit.pdf",
  sizeBytes: 1234,
  contentType: "application/pdf"
};

const ROW = {
  id: DOCUMENT_ID,
  owner_user_id: OWNER,
  kind: "cuit",
  object_path: OBJECT_PATH,
  name: "cuit.pdf",
  size_bytes: 1234,
  content_type: "application/pdf",
  created_at: CREATED_AT
};

const EXPECTED = {
  documentId: DOCUMENT_ID,
  ...INPUT,
  createdAt: CREATED_AT
};

interface FakeStep {
  readonly data?: unknown;
  readonly error?: { code: string; message: string; details: string; hint: string } | null;
  readonly reject?: Error;
}

function fakeClient(step: FakeStep) {
  const calls = {
    from: [] as string[],
    insert: [] as unknown[],
    eq: [] as Array<readonly [string, unknown]>,
    order: [] as Array<readonly [string, unknown]>,
    single: 0,
    maybeSingle: 0,
    delete: 0
  };
  const result = () =>
    step.reject
      ? Promise.reject(step.reject)
      : Promise.resolve({ data: step.data ?? null, error: step.error ?? null });

  const builder = {
    insert: (payload: unknown) => {
      calls.insert.push(payload);
      return builder;
    },
    select: () => builder,
    delete: () => {
      calls.delete += 1;
      return builder;
    },
    eq: (column: string, value: unknown) => {
      calls.eq.push([column, value]);
      return builder;
    },
    order: (column: string, options: unknown) => {
      calls.order.push([column, options]);
      return builder;
    },
    single: () => {
      calls.single += 1;
      return result();
    },
    maybeSingle: () => {
      calls.maybeSingle += 1;
      return result();
    },
    // `await builder` (the delete/list terminal) resolves to the configured step.
    then: (onFulfilled: (value: unknown) => unknown, onRejected: (reason: unknown) => unknown) =>
      result().then(onFulfilled, onRejected)
  };

  const client = {
    from: (table: string) => {
      calls.from.push(table);
      return builder;
    }
  } as unknown as SupabaseClient;

  return { client, calls };
}

const pgError = (code: string) => ({
  code,
  message: "SECRET message",
  details: "SECRET details",
  hint: "SECRET hint"
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SupabasePymeDocumentRepository.create", () => {
  it("inserts the descriptor with the server-derived fields and maps the stored row", async () => {
    const { client, calls } = fakeClient({ data: ROW });

    const result = await new SupabasePymeDocumentRepository(client).create(INPUT);

    expect(calls.from).toEqual(["pyme_document"]);
    expect(calls.insert).toEqual([
      {
        owner_user_id: OWNER,
        kind: "cuit",
        object_path: OBJECT_PATH,
        name: "cuit.pdf",
        size_bytes: 1234,
        content_type: "application/pdf"
      }
    ]);
    expect(calls.single).toBe(1);
    expect(result).toEqual({ ok: true, value: EXPECTED });
  });

  it("maps a check violation to invalid_request without leaking Postgres text", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ error: pgError("23514") });

    const result = await new SupabasePymeDocumentRepository(client).create(INPUT);

    expect(result).toEqual({ ok: false, error: { code: "invalid_request" } });
    expect(JSON.stringify(result)).not.toContain("SECRET");
    expect(consoleError).toHaveBeenCalled();
  });

  it("is unavailable for any other error, a null payload, or a malformed stored row", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const step of [
      { error: pgError("42501") },
      { data: null },
      { data: { ...ROW, id: 42 } },
      { data: { ...ROW, size_bytes: "abc" } },
      { reject: new Error("network SECRET") }
    ] as const) {
      const { client } = fakeClient(step);
      const result = await new SupabasePymeDocumentRepository(client).create(INPUT);
      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    }
  });
});

describe("SupabasePymeDocumentRepository.listByOwner", () => {
  it("scopes the read by owner_user_id and orders oldest first, mapping every row", async () => {
    const { client, calls } = fakeClient({ data: [ROW] });

    const result = await new SupabasePymeDocumentRepository(client).listByOwner(OWNER);

    expect(calls.from).toEqual(["pyme_document"]);
    expect(calls.eq).toEqual([["owner_user_id", OWNER]]);
    expect(calls.order).toEqual([["created_at", { ascending: true }]]);
    expect(result).toEqual({ ok: true, value: [EXPECTED] });
  });

  it("is an empty list when the owner has no documents", async () => {
    const { client } = fakeClient({ data: [] });

    expect(await new SupabasePymeDocumentRepository(client).listByOwner(OWNER)).toEqual({
      ok: true,
      value: []
    });
  });

  it("is unavailable on a Postgres error, a non-array payload, or a malformed row", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const step of [
      { error: pgError("XX000") },
      { data: null },
      { data: { ...ROW } },
      { data: [{ ...ROW, created_at: null }] }
    ] as const) {
      const { client } = fakeClient(step);
      expect(await new SupabasePymeDocumentRepository(client).listByOwner(OWNER)).toEqual({
        ok: false,
        error: { code: "unavailable" }
      });
    }
  });
});

describe("SupabasePymeDocumentRepository.deleteByObjectPath", () => {
  it("deletes by object_path and treats zero matched rows as the idempotent success it is", async () => {
    const { client, calls } = fakeClient({ data: null });

    const result = await new SupabasePymeDocumentRepository(client).deleteByObjectPath(OBJECT_PATH);

    expect(calls.from).toEqual(["pyme_document"]);
    expect(calls.delete).toBe(1);
    expect(calls.eq).toEqual([["object_path", OBJECT_PATH]]);
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("is unavailable on a Postgres error or a rejected call", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const step of [{ error: pgError("XX000") }, { reject: new Error("network SECRET") }] as const) {
      const { client } = fakeClient(step);
      expect(await new SupabasePymeDocumentRepository(client).deleteByObjectPath(OBJECT_PATH)).toEqual({
        ok: false,
        error: { code: "unavailable" }
      });
    }
  });
});

describe("SupabasePymeDocumentRepository.findByObjectPath", () => {
  it("looks up one persisted descriptor by object_path and maps it", async () => {
    const { client, calls } = fakeClient({ data: ROW });

    const result = await new SupabasePymeDocumentRepository(client).findByObjectPath(OBJECT_PATH);

    expect(calls.from).toEqual(["pyme_document"]);
    expect(calls.eq).toEqual([["object_path", OBJECT_PATH]]);
    expect(calls.maybeSingle).toBe(1);
    expect(result).toEqual({ ok: true, value: EXPECTED });
  });

  it("treats an empty result as a missing descriptor and sanitizes failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const missing = await new SupabasePymeDocumentRepository(fakeClient({ data: null }).client).findByObjectPath(
      OBJECT_PATH
    );
    expect(missing).toEqual({ ok: true, value: undefined });

    const failure = await new SupabasePymeDocumentRepository(
      fakeClient({ error: pgError("XX000") }).client
    ).findByObjectPath(OBJECT_PATH);
    expect(failure).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});
