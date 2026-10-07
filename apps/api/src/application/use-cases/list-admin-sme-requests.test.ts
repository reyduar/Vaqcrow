import { parseApplicationId } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type { SmeRequestRepositoryPort } from "../ports/sme-request-repository-port.js";
import {
  DEFAULT_ADMIN_QUEUE_PAGE_SIZE,
  MAX_ADMIN_QUEUE_PAGE_SIZE,
  listAdminSmeRequests,
  parseAdminQueueQuery
} from "./list-admin-sme-requests.js";

const APPLICATION_ID = parseApplicationId("11111111-1111-4111-8111-111111111111");

const item = {
  applicationId: APPLICATION_ID,
  name: "Panadería Sol",
  sector: "Alimentos",
  state: "human_review" as const,
  updatedAt: "2026-10-04T12:00:00.000Z"
};

describe("parseAdminQueueQuery", () => {
  it("applies the documented defaults for an empty query", () => {
    expect(parseAdminQueueQuery({})).toEqual({
      ok: true,
      value: { page: 1, pageSize: DEFAULT_ADMIN_QUEUE_PAGE_SIZE, sort: "updatedAt", order: "desc" }
    });
  });

  it("parses every supported parameter and clamps the page size to the maximum", () => {
    expect(
      parseAdminQueueQuery({ page: "3", pageSize: "500", sort: "name", order: "asc", q: "  Panadería  " })
    ).toEqual({
      ok: true,
      value: { page: 3, pageSize: MAX_ADMIN_QUEUE_PAGE_SIZE, sort: "name", order: "asc", search: "Panadería" }
    });
  });

  it("drops a blank search", () => {
    const parsed = parseAdminQueueQuery({ q: "   " });

    expect(parsed.ok && parsed.value.search).toBeUndefined();
  });

  it("strips PostgREST filter metacharacters from the search term", () => {
    const parsed = parseAdminQueueQuery({ q: "a,b(c)*%" });

    expect(parsed.ok && parsed.value.search).toBe("a b c");
  });

  it.each([
    ["a non-numeric page", { page: "two" }],
    ["a zero page", { page: "0" }],
    ["a zero page size", { pageSize: "0" }],
    ["an unknown sort", { sort: "updated_at" }],
    ["an unknown order", { order: "down" }],
    ["an unknown key", { limit: "1" }],
    ["a repeated parameter", { page: ["1", "2"] }]
  ])("rejects %s with a sanitized invalid_request", (_label, query) => {
    expect(parseAdminQueueQuery(query)).toEqual({ ok: false, code: "invalid_request" });
  });

  it("rejects a non-object query", () => {
    expect(parseAdminQueueQuery("page=1")).toEqual({ ok: false, code: "invalid_request" });
  });
});

describe("listAdminSmeRequests", () => {
  function repository(overrides: Partial<SmeRequestRepositoryPort> = {}): SmeRequestRepositoryPort {
    return {
      submit: vi.fn(),
      findByApplicationId: vi.fn(),
      listAdminQueue: vi.fn().mockResolvedValue({ ok: true, value: { items: [item], total: 1 } }),
      ...overrides
    };
  }

  it("passes the resolved query to the repository and echoes the page metadata", async () => {
    const repo = repository();

    const result = await listAdminSmeRequests({ repository: repo }, { query: { page: "2", pageSize: "10" } });

    expect(repo.listAdminQueue).toHaveBeenCalledWith({ page: 2, pageSize: 10, sort: "updatedAt", order: "desc" });
    expect(result).toEqual({ ok: true, value: { items: [item], page: 2, pageSize: 10, total: 1 } });
  });

  it("does not touch the repository for a malformed query", async () => {
    const repo = repository();

    expect(await listAdminSmeRequests({ repository: repo }, { query: { sort: "nope" } })).toEqual({
      ok: false,
      error: { code: "invalid_request" }
    });
    expect(repo.listAdminQueue).not.toHaveBeenCalled();
  });

  it("reports a repository failure as a sanitized unavailable", async () => {
    const repo = repository({
      listAdminQueue: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } })
    });

    expect(await listAdminSmeRequests({ repository: repo }, { query: {} })).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});
