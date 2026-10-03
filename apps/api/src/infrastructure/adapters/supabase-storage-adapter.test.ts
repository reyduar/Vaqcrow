import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseStorageAdapter } from "./supabase-storage-adapter.js";

const PATH = "00000000-0000-4000-8000-000000000004/cuit/x.pdf";
const BYTES = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]);

interface UploadProviderResult {
  readonly data: unknown;
  readonly error: unknown;
}

interface RemoveProviderResult {
  readonly error: unknown;
}

interface Fake {
  readonly upload?: UploadProviderResult;
  readonly uploadReject?: Error;
  readonly remove?: RemoveProviderResult;
  readonly removeReject?: Error;
}

/** A hand-written structural client: no network, no Supabase. */
function fakeClient(fake: Fake) {
  const calls = {
    upload: [] as Array<{ path: string; options: unknown }>,
    remove: [] as string[][],
    bucket: [] as string[]
  };
  const bucket = {
    upload: (path: string, _bytes: unknown, options: unknown) => {
      calls.upload.push({ path, options });
      return fake.uploadReject
        ? Promise.reject(fake.uploadReject)
        : Promise.resolve(fake.upload ?? { data: { path }, error: null });
    },
    remove: (paths: string[]) => {
      calls.remove.push(paths);
      return fake.removeReject
        ? Promise.reject(fake.removeReject)
        : Promise.resolve(fake.remove ?? { error: null });
    }
  };
  const client = {
    storage: {
      from: (name: string) => {
        calls.bucket.push(name);
        return bucket;
      }
    }
  } as unknown as SupabaseClient;
  return { client, calls };
}

afterEach(() => vi.restoreAllMocks());

describe("SupabaseStorageAdapter.uploadObject", () => {
  it("returns the stored path on success and never upserts", async () => {
    const { client, calls } = fakeClient({});

    const result = await new SupabaseStorageAdapter(client).uploadObject({
      path: PATH,
      bytes: BYTES,
      contentType: "application/pdf"
    });

    expect(result).toEqual({ ok: true, value: { path: PATH } });
    expect(calls.upload).toEqual([{ path: PATH, options: { contentType: "application/pdf", upsert: false } }]);
  });

  it("maps a provider 404 to not_found", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({
      upload: { data: null, error: { message: "Object not found", statusCode: "404" } }
    });

    const result = await new SupabaseStorageAdapter(client).uploadObject({
      path: PATH,
      bytes: BYTES,
      contentType: "application/pdf"
    });

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
  });

  it("maps any other provider error to unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({
      upload: { data: null, error: { message: "boom", statusCode: "500" } }
    });

    const result = await new SupabaseStorageAdapter(client).uploadObject({
      path: PATH,
      bytes: BYTES,
      contentType: "application/pdf"
    });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("answers unavailable for a null or non-string data.path", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const data of [{ path: null }, { path: 42 }, null]) {
      const { client } = fakeClient({ upload: { data, error: null } });

      const result = await new SupabaseStorageAdapter(client).uploadObject({
        path: PATH,
        bytes: BYTES,
        contentType: "application/pdf"
      });

      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    }
  });

  it("answers unavailable when the provider throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ uploadReject: new Error("ECONNRESET") });

    const result = await new SupabaseStorageAdapter(client).uploadObject({
      path: PATH,
      bytes: BYTES,
      contentType: "application/pdf"
    });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("never lets a provider message, details or hint cross the port", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({
      upload: {
        data: null,
        error: { message: "secret message", details: "secret details", hint: "secret hint", statusCode: "500" }
      }
    });

    const result = await new SupabaseStorageAdapter(client).uploadObject({
      path: PATH,
      bytes: BYTES,
      contentType: "application/pdf"
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("secret message");
    expect(serialized).not.toContain("secret details");
    expect(serialized).not.toContain("secret hint");
  });
});

describe("SupabaseStorageAdapter.removeObject", () => {
  it("removes one object and reports success", async () => {
    const { client, calls } = fakeClient({});

    const result = await new SupabaseStorageAdapter(client).removeObject(PATH);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(calls.remove).toEqual([[PATH]]);
  });

  it("maps a provider 404 to not_found so the route can treat it as idempotent", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ remove: { error: { message: "already gone", statusCode: "404" } } });

    const result = await new SupabaseStorageAdapter(client).removeObject(PATH);

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
  });

  it("answers unavailable when the provider throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ removeReject: new TypeError("socket hang up") });

    const result = await new SupabaseStorageAdapter(client).removeObject(PATH);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});
