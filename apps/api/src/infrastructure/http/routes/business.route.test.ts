import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BusinessDraft, BusinessRecord, BusinessRepositoryPort } from "../../../application/ports/business-repository-port.js";
import { principalFor } from "../test-support/auth.js";
import { buildAppAs } from "../test-support/auth.js";

const OWNER = principalFor("PYME").userId;
const BUSINESS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const draft: BusinessDraft = {
  name: "Panadería Sol",
  cuit: "20123456789",
  sector: "Alimentos",
  city: "CABA",
  description: "Panadería artesanal de barrio",
  goalArs: 5_000_000,
  revenueShare: 5
};

const record: BusinessRecord = {
  ...draft,
  businessId: BUSINESS_ID,
  ownerUserId: OWNER,
  createdAt: "2026-10-03T12:00:00.000Z",
  updatedAt: "2026-10-03T12:00:00.000Z"
};

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

function build(repository: Partial<BusinessRepositoryPort> = {}): FastifyInstance {
  app = buildAppAs("PYME", {
    business: {
      repository: {
        createForOwner: vi.fn().mockResolvedValue({ ok: true, value: record }),
        findByOwner: vi.fn().mockResolvedValue({ ok: true, value: record }),
        findOwnedById: vi.fn().mockResolvedValue({ ok: true, value: record }),
        ...repository
      }
    }
  });
  return app;
}

describe("POST /businesses", () => {
  it("creates the caller's company and answers 201 with the stored company", async () => {
    const createForOwner = vi.fn().mockResolvedValue({ ok: true, value: record });

    const response = await build({ createForOwner }).inject({
      method: "POST",
      url: "/businesses",
      payload: draft
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ business: record });
    expect(createForOwner).toHaveBeenCalledWith({ ownerUserId: OWNER, draft });
  });

  it("accepts an optional deadline and creates the company with it", async () => {
    const deadline = "2026-12-01T00:00:00.000Z";
    const createForOwner = vi.fn().mockResolvedValue({ ok: true, value: { ...record, deadline } });

    const response = await build({ createForOwner }).inject({
      method: "POST",
      url: "/businesses",
      payload: { ...draft, deadline }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ business: { ...record, deadline } });
    expect(createForOwner).toHaveBeenCalledWith({ ownerUserId: OWNER, draft: { ...draft, deadline } });
  });

  it("answers 400 with the sanitized envelope for a malformed deadline", async () => {
    const createForOwner = vi.fn();

    const response = await build({ createForOwner }).inject({
      method: "POST",
      url: "/businesses",
      payload: { ...draft, deadline: "tomorrow" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ errors: [{ field: "deadline", code: "invalid_format" }] });
    expect(createForOwner).not.toHaveBeenCalled();
  });

  it("refuses an owner supplied in the body and never persists", async () => {
    const createForOwner = vi.fn();

    const response = await build({ createForOwner }).inject({
      method: "POST",
      url: "/businesses",
      payload: { ...draft, ownerUserId: "attacker" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ errors: [{ field: "body", code: "invalid" }] });
    expect(createForOwner).not.toHaveBeenCalled();
  });

  it("answers 400 with the { errors: [{ field, code }] } envelope for an invalid field", async () => {
    const createForOwner = vi.fn();

    const response = await build({ createForOwner }).inject({
      method: "POST",
      url: "/businesses",
      payload: { ...draft, cuit: "123" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ errors: [{ field: "cuit", code: "invalid_format" }] });
    expect(createForOwner).not.toHaveBeenCalled();
  });

  it("answers 503 when persistence is unavailable", async () => {
    const createForOwner = vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } });

    const response = await build({ createForOwner }).inject({
      method: "POST",
      url: "/businesses",
      payload: draft
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });
});

describe("GET /businesses/mine", () => {
  it("returns the caller's own company", async () => {
    const response = await build().inject({ method: "GET", url: "/businesses/mine" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ business: record });
  });

  it("answers 404 when the caller has not registered a company", async () => {
    const findByOwner = vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } });

    const response = await build({ findByOwner }).inject({ method: "GET", url: "/businesses/mine" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
  });

  it("answers 503 when the read is unavailable", async () => {
    const findByOwner = vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } });

    const response = await build({ findByOwner }).inject({ method: "GET", url: "/businesses/mine" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });
});
