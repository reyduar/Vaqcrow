import type { AxiosInstance } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpUploadAdapter } from "./http-upload-adapter";

interface Call {
  readonly method: "post" | "delete";
  readonly url: string;
  readonly data: unknown;
  readonly config: Record<string, unknown> | undefined;
}

interface Fake {
  readonly post?: { status: number; data: unknown } | Error;
  readonly remove?: { status: number; data: unknown } | Error;
}

function fakeClient(fake: Fake) {
  const calls: Call[] = [];
  const client = {
    post: async (url: string, data: unknown, config: Record<string, unknown> | undefined) => {
      calls.push({ method: "post", url, data, config });
      if (fake.post instanceof Error) throw fake.post;
      return fake.post ?? { status: 201, data: { path: `${url}/x`, name: "x.pdf", size: 10, contentType: "application/pdf" } };
    },
    delete: async (url: string, config: Record<string, unknown> | undefined) => {
      calls.push({ method: "delete", url, data: undefined, config });
      if (fake.remove instanceof Error) throw fake.remove;
      return fake.remove ?? { status: 204, data: undefined };
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

function file(): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "cuit.pdf", { type: "application/pdf" });
}

afterEach(() => vi.restoreAllMocks());

describe("HttpUploadAdapter.uploadDocument", () => {
  it("posts multipart with the kind and file, and returns the stored descriptor", async () => {
    const { client, calls } = fakeClient({
      post: { status: 201, data: { path: "u/cuit/x.pdf", kind: "cuit", name: "cuit.pdf", size: 4, contentType: "application/pdf" } }
    });
    const adapter = new HttpUploadAdapter(client, async () => "token-123");

    const result = await adapter.uploadDocument({ kind: "cuit", file: file() });

    expect(result).toEqual({ ok: true, path: "u/cuit/x.pdf", name: "cuit.pdf", size: 4, contentType: "application/pdf" });
    const call = calls[0]!;
    expect(call.method).toBe("post");
    expect(call.url).toBe("/storage/uploads");
    const form = call.data as FormData;
    expect(form.get("kind")).toBe("cuit");
    expect((form.get("file") as File).name).toBe("cuit.pdf");
    expect(call.config?.["headers"]).toEqual({ Authorization: "Bearer token-123" });
  });

  it("reports transport progress as a whole percentage", async () => {
    const { client, calls } = fakeClient({});
    const adapter = new HttpUploadAdapter(client, async () => "token");
    const progress: number[] = [];

    await adapter.uploadDocument({ kind: "cuit", file: file(), onProgress: (percent) => progress.push(percent) });

    const onUploadProgress = calls[0]!.config?.["onUploadProgress"] as (event: { loaded: number; total?: number }) => void;
    onUploadProgress({ loaded: 50, total: 200 });
    onUploadProgress({ loaded: 200, total: 200 });
    onUploadProgress({ loaded: 10 });

    expect(progress).toEqual([25, 100]);
  });

  it("sends no Authorization header when there is no token", async () => {
    const { client, calls } = fakeClient({});
    const adapter = new HttpUploadAdapter(client, async () => null);

    await adapter.uploadDocument({ kind: "cuit", file: file() });

    expect(calls[0]!.config?.["headers"]).toEqual({});
  });

  it("prefers the sanitized code of the API envelope", async () => {
    const { client } = fakeClient({ post: { status: 400, data: { code: "invalid_name" } } });
    const adapter = new HttpUploadAdapter(client);

    expect(await adapter.uploadDocument({ kind: "cuit", file: file() })).toEqual({ ok: false, code: "invalid_name" });
  });

  it("maps 413 and 415 to too_large and unsupported_type when no code travels", async () => {
    const tooLarge = fakeClient({ post: { status: 413, data: {} } });
    const unsupported = fakeClient({ post: { status: 415, data: {} } });

    expect(await new HttpUploadAdapter(tooLarge.client).uploadDocument({ kind: "cuit", file: file() })).toEqual({
      ok: false,
      code: "too_large"
    });
    expect(await new HttpUploadAdapter(unsupported.client).uploadDocument({ kind: "cuit", file: file() })).toEqual({
      ok: false,
      code: "unsupported_type"
    });
  });

  it("gives 401 and 403 their own unauthorized code, not unavailable", async () => {
    const expired = fakeClient({ post: { status: 401, data: {} } });
    const wrongRole = fakeClient({ post: { status: 403, data: {} } });

    expect(await new HttpUploadAdapter(expired.client).uploadDocument({ kind: "cuit", file: file() })).toEqual({
      ok: false,
      code: "unauthorized"
    });
    expect(await new HttpUploadAdapter(wrongRole.client).uploadDocument({ kind: "cuit", file: file() })).toEqual({
      ok: false,
      code: "unauthorized"
    });
  });

  it("answers unavailable for a 503 or a malformed success body", async () => {
    const serverError = fakeClient({ post: { status: 503, data: { code: "unavailable" } } });
    const malformed = fakeClient({ post: { status: 201, data: { path: 42 } } });

    expect(await new HttpUploadAdapter(serverError.client).uploadDocument({ kind: "cuit", file: file() })).toEqual({
      ok: false,
      code: "unavailable"
    });
    expect(await new HttpUploadAdapter(malformed.client).uploadDocument({ kind: "cuit", file: file() })).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("answers network when the transport throws", async () => {
    const { client } = fakeClient({ post: new Error("socket hang up") });

    expect(await new HttpUploadAdapter(client).uploadDocument({ kind: "cuit", file: file() })).toEqual({
      ok: false,
      code: "network"
    });
  });
});

describe("HttpUploadAdapter.removeDocument", () => {
  it("deletes with the url-encoded query form and reports success on 204", async () => {
    const { client, calls } = fakeClient({});
    const adapter = new HttpUploadAdapter(client, async () => "token");

    const result = await adapter.removeDocument("u/cuit/x y.pdf");

    expect(result).toEqual({ ok: true });
    expect(calls[0]!.method).toBe("delete");
    expect(calls[0]!.url).toBe("/storage/uploads?path=u%2Fcuit%2Fx%20y.pdf");
    expect(calls[0]!.config?.["headers"]).toEqual({ Authorization: "Bearer token" });
  });

  it("maps a 403 to unauthorized even when the envelope code is outside the vocabulary", async () => {
    const { client } = fakeClient({ remove: { status: 403, data: { code: "forbidden" } } });

    expect(await new HttpUploadAdapter(client).removeDocument("u/cuit/x.pdf")).toEqual({
      ok: false,
      code: "unauthorized"
    });
  });

  it("still maps a 503 to unavailable", async () => {
    const { client } = fakeClient({ remove: { status: 503, data: { code: "unavailable" } } });

    expect(await new HttpUploadAdapter(client).removeDocument("u/cuit/x.pdf")).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("answers network when the transport throws", async () => {
    const { client } = fakeClient({ remove: new Error("offline") });

    expect(await new HttpUploadAdapter(client).removeDocument("u/cuit/x.pdf")).toEqual({ ok: false, code: "network" });
  });
});
