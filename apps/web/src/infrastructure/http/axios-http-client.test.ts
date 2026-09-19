import { AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";
import { AxiosHttpClient, HttpClientError } from "./axios-http-client";

type RequestFn = (config: AxiosRequestConfig) => Promise<unknown>;

function fakeInstance(request: RequestFn): AxiosInstance {
  return { request } as unknown as AxiosInstance;
}

describe("AxiosHttpClient", () => {
  it("maps a 2xx response to status and body", async () => {
    const request = vi.fn<RequestFn>().mockResolvedValue({
      status: 200,
      data: { id: "w1" },
      headers: { "set-cookie": "secret" },
      config: { headers: { Authorization: "Bearer secret" } }
    });
    const client = new AxiosHttpClient(fakeInstance(request));

    const response = await client.send<{ id: string }>({ method: "GET", path: "/workspaces" });

    expect(response).toEqual({ status: 200, body: { id: "w1" } });
  });

  it("sends method, path and JSON body to axios", async () => {
    const request = vi.fn<RequestFn>().mockResolvedValue({ status: 201, data: {} });
    const client = new AxiosHttpClient(fakeInstance(request));

    await client.send({ method: "POST", path: "/workspaces", body: { name: "acme" } });

    expect(request).toHaveBeenCalledTimes(1);
    const config = request.mock.calls[0]![0];
    expect(config.method).toBe("POST");
    expect(config.url).toBe("/workspaces");
    expect(config.data).toEqual({ name: "acme" });
  });

  it("omits the body for requests without one", async () => {
    const request = vi.fn<RequestFn>().mockResolvedValue({ status: 200, data: [] });
    const client = new AxiosHttpClient(fakeInstance(request));

    await client.send({ method: "GET", path: "/workspaces" });

    expect(request.mock.calls[0]![0].data).toBeUndefined();
  });

  it("accepts every status so non-2xx is mapped by the adapter, not by axios", async () => {
    const request = vi.fn<RequestFn>().mockResolvedValue({ status: 200, data: {} });
    const client = new AxiosHttpClient(fakeInstance(request));

    await client.send({ method: "GET", path: "/x" });

    const validate = request.mock.calls[0]![0].validateStatus;
    expect(validate?.(404)).toBe(true);
    expect(validate?.(500)).toBe(true);
  });

  it("rejects non-2xx responses with a sanitized HttpClientError carrying only the status", async () => {
    const request = vi.fn<RequestFn>().mockResolvedValue({
      status: 422,
      data: { message: "internal detail", stack: "trace" },
      headers: { authorization: "Bearer secret" }
    });
    const client = new AxiosHttpClient(fakeInstance(request));

    const error = await client.send({ method: "POST", path: "/x", body: {} }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpClientError);
    expect((error as HttpClientError).kind).toBe("http");
    expect((error as HttpClientError).status).toBe(422);
    expect(JSON.stringify(error)).not.toContain("secret");
    expect((error as HttpClientError).message).not.toContain("internal detail");
  });

  it("rejects network failures with a sanitized error and no raw axios data", async () => {
    const axiosError = new AxiosError("connect ECONNREFUSED 10.0.0.1:443 token=abc", "ECONNREFUSED", {
      headers: { Authorization: "Bearer secret" }
    } as never);
    const client = new AxiosHttpClient(fakeInstance(vi.fn<RequestFn>().mockRejectedValue(axiosError)));

    const error = await client.send({ method: "GET", path: "/x" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpClientError);
    expect((error as HttpClientError).kind).toBe("network");
    expect((error as HttpClientError).status).toBeUndefined();
    expect((error as HttpClientError).message).not.toContain("10.0.0.1");
    expect((error as HttpClientError).message).not.toContain("abc");
    expect((error as HttpClientError).cause).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain("secret");
  });

  it("surfaces a timeout as a sanitized network error that never claims a response", async () => {
    const timeout = new AxiosError("timeout of 10000ms exceeded for https://api.internal/x?token=abc", "ECONNABORTED");
    const client = new AxiosHttpClient(fakeInstance(vi.fn<RequestFn>().mockRejectedValue(timeout)));

    const error = await client.send({ method: "POST", path: "/x", body: {} }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpClientError);
    expect((error as HttpClientError).kind).toBe("network");
    expect((error as HttpClientError).status).toBeUndefined();
    expect((error as HttpClientError).message).not.toContain("api.internal");
    expect((error as HttpClientError).message).not.toContain("abc");
  });

  it("sanitizes non-axios failures the same way", async () => {
    const client = new AxiosHttpClient(
      fakeInstance(vi.fn<RequestFn>().mockRejectedValue(new Error("boom secret")))
    );

    const error = await client.send({ method: "GET", path: "/x" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpClientError);
    expect((error as HttpClientError).message).not.toContain("secret");
  });

  it("passes configured base headers to axios.create without exposing them in errors", async () => {
    const created = vi.fn<(config: AxiosRequestConfig) => AxiosInstance>().mockReturnValue(
      fakeInstance(vi.fn<RequestFn>().mockRejectedValue(new Error("x")))
    );

    const client = AxiosHttpClient.create(
      { baseUrl: "https://api.example.test", headers: { "X-Api-Key": "secret" } },
      created
    );
    const error = await client.send({ method: "GET", path: "/x" }).catch((e: unknown) => e);

    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://api.example.test",
        headers: { "X-Api-Key": "secret" }
      })
    );
    expect(JSON.stringify(error)).not.toContain("secret");
  });

  it("applies a default 10s timeout and lets callers override it", () => {
    const created = vi
      .fn<(config: AxiosRequestConfig) => AxiosInstance>()
      .mockReturnValue(fakeInstance(vi.fn<RequestFn>()));

    AxiosHttpClient.create({ baseUrl: "https://api.example.test" }, created);
    AxiosHttpClient.create({ baseUrl: "https://api.example.test", timeoutMs: 2500 }, created);

    expect(created.mock.calls[0]![0].timeout).toBe(10_000);
    expect(created.mock.calls[1]![0].timeout).toBe(2500);
  });

  describe("field errors from the documented { errors: [{ field, code }] } envelope", () => {
    async function failWith(data: unknown): Promise<HttpClientError> {
      const client = new AxiosHttpClient(
        fakeInstance(vi.fn<RequestFn>().mockResolvedValue({ status: 422, data }))
      );
      return (await client.send({ method: "POST", path: "/x", body: {} }).catch((e: unknown) => e)) as HttpClientError;
    }

    it("surfaces only sanitized field codes", async () => {
      const error = await failWith({
        errors: [
          { field: "periodEnd", code: "before_start", message: "raw backend text" },
          { field: "declaredTotalArs", code: "not_integer" }
        ],
        stack: "trace"
      });

      expect(error.status).toBe(422);
      expect(error.fieldErrors).toEqual({ periodEnd: "before_start", declaredTotalArs: "not_integer" });
      expect(JSON.stringify(error)).not.toContain("raw backend text");
      expect(JSON.stringify(error)).not.toContain("trace");
    });

    it("drops malformed entries, odd characters and oversized tokens", async () => {
      const error = await failWith({
        errors: [
          { field: "periodEnd", code: "<script>" },
          { field: "a".repeat(80), code: "ok_code" },
          { field: 3, code: "ok_code" },
          "nope",
          null,
          { field: "periodStart", code: "required" }
        ]
      });

      expect(error.fieldErrors).toEqual({ periodStart: "required" });
    });

    it("omits fieldErrors when the body has no usable envelope", async () => {
      for (const data of [undefined, null, "boom", { errors: "x" }, { errors: [] }, { errors: [{}] }]) {
        const error = await failWith(data);
        expect(error.fieldErrors).toBeUndefined();
        expect(error.status).toBe(422);
      }
    });

    it("ignores field-name keys that could pollute prototypes", async () => {
      const error = await failWith({ errors: [{ field: "__proto__", code: "x" }] });

      expect(error.fieldErrors).toBeUndefined();
      expect(({} as Record<string, unknown>).x).toBeUndefined();
    });
  });
  describe("error code from the documented { code } envelope", () => {
    async function failWith(status: number, data: unknown): Promise<HttpClientError> {
      const client = new AxiosHttpClient(
        fakeInstance(vi.fn<RequestFn>().mockResolvedValue({ status, data }))
      );
      return (await client.send({ method: "POST", path: "/x", body: {} }).catch((e: unknown) => e)) as HttpClientError;
    }

    it("surfaces a sanitized machine code and drops everything else", async () => {
      const error = await failWith(409, { code: "state_conflict", actualState: "approved", message: "raw" });

      expect(error.errorCode).toBe("state_conflict");
      expect(JSON.stringify(error)).not.toContain("raw");
    });

    it("drops codes that are not identifier-shaped", async () => {
      for (const data of [{ code: "<script>" }, { code: 7 }, { code: "A".repeat(80) }, {}, null]) {
        expect((await failWith(409, data)).errorCode).toBeUndefined();
      }
    });
  });
});
