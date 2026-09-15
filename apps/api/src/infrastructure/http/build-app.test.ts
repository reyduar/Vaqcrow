import { describe, expect, it } from "vitest";
import { buildApp } from "./build-app.js";

describe("buildApp", () => {
  it("responds to GET /health with 200 via inject(), without opening a network listener", async () => {
    const app = buildApp();

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(app.server.listening).toBe(false);

    await app.close();
  });

  it("returns a JSON body reporting ok status from the health handler", async () => {
    const app = buildApp();

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.json()).toEqual({ status: "ok" });

    await app.close();
  });

  it("returns 404 for a route that was never registered, proving routing is specific", async () => {
    const app = buildApp();

    const response = await app.inject({ method: "GET", url: "/does-not-exist" });

    expect(response.statusCode).toBe(404);

    await app.close();
  });
});
