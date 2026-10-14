import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import { HttpBlogGateway } from "./http-blog-gateway";

const SLUG = "vaqcrow-explicado";

const WIRE_SUMMARY = {
  slug: SLUG,
  title: "Vaqcrow, explicado",
  summary: "Cómo funciona el financiamiento por revenue share sobre Stellar.",
  publishedAt: "2026-10-14T12:00:00.000Z"
};

const WIRE_POST = {
  ...WIRE_SUMMARY,
  tags: ["stellar", "revenue-share"],
  body: "# Vaqcrow, explicado\n\nUn párrafo con **negrita**."
};

function fakeClient(result: { status: number; data: unknown } | Error) {
  const calls: string[] = [];
  const client = {
    get: async (url: string) => {
      calls.push(url);
      if (result instanceof Error) throw result;
      return result;
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

describe("HttpBlogGateway.listPosts", () => {
  it("reads the published list", async () => {
    const { client, calls } = fakeClient({ status: 200, data: { items: [WIRE_SUMMARY] } });
    const gateway = new HttpBlogGateway(client);

    const result = await gateway.listPosts();

    expect(calls[0]).toBe("/blog");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(WIRE_SUMMARY);
  });

  it("maps any non-200 status to unavailable", async () => {
    const { client } = fakeClient({ status: 503, data: { code: "unavailable" } });
    const gateway = new HttpBlogGateway(client);

    expect(await gateway.listPosts()).toEqual({ ok: false, code: "unavailable" });
  });

  it("rejects a malformed success body instead of rendering it", async () => {
    const { client } = fakeClient({ status: 200, data: { items: [{ slug: "NOT A SLUG" }] } });
    const gateway = new HttpBlogGateway(client);

    expect(await gateway.listPosts()).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps a transport failure to network", async () => {
    const { client } = fakeClient(new Error("boom"));
    const gateway = new HttpBlogGateway(client);

    expect(await gateway.listPosts()).toEqual({ ok: false, code: "network" });
  });
});

describe("HttpBlogGateway.findPostBySlug", () => {
  it("reads one post with its tags and body", async () => {
    const { client, calls } = fakeClient({ status: 200, data: WIRE_POST });
    const gateway = new HttpBlogGateway(client);

    const result = await gateway.findPostBySlug(SLUG);

    expect(calls[0]).toBe(`/blog/${SLUG}`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.post.title).toBe("Vaqcrow, explicado");
    expect(result.post.tags).toEqual(["stellar", "revenue-share"]);
    expect(result.post.body).toContain("**negrita**");
  });

  it("percent-encodes the slug in the request path", async () => {
    const { client, calls } = fakeClient({ status: 200, data: WIRE_POST });
    const gateway = new HttpBlogGateway(client);

    await gateway.findPostBySlug("a/../etc");

    expect(calls[0]).toBe(`/blog/${encodeURIComponent("a/../etc")}`);
  });

  it("maps 404 to not_found", async () => {
    const { client } = fakeClient({ status: 404, data: { code: "not_found" } });
    const gateway = new HttpBlogGateway(client);

    expect(await gateway.findPostBySlug(SLUG)).toEqual({ ok: false, code: "not_found" });
  });

  it("maps any other non-200 status to unavailable", async () => {
    const { client } = fakeClient({ status: 500, data: { code: "unavailable" } });
    const gateway = new HttpBlogGateway(client);

    expect(await gateway.findPostBySlug(SLUG)).toEqual({ ok: false, code: "unavailable" });
  });

  it("rejects a malformed success body instead of rendering it", async () => {
    const { client } = fakeClient({ status: 200, data: { ...WIRE_POST, publishedAt: "not-a-date" } });
    const gateway = new HttpBlogGateway(client);

    expect(await gateway.findPostBySlug(SLUG)).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps a transport failure to network", async () => {
    const { client } = fakeClient(new Error("boom"));
    const gateway = new HttpBlogGateway(client);

    expect(await gateway.findPostBySlug(SLUG)).toEqual({ ok: false, code: "network" });
  });
});

describe("HttpBlogGateway.create", () => {
  it("builds a gateway whose reads are callable", () => {
    const gateway = HttpBlogGateway.create("http://localhost:3000");
    expect(typeof gateway.listPosts).toBe("function");
    expect(typeof gateway.findPostBySlug).toBe("function");
  });
});
