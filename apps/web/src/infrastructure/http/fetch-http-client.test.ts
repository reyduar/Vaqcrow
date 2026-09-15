import { describe, expect, it } from "vitest";
import { FetchHttpClient } from "./fetch-http-client";

describe("FetchHttpClient", () => {
  it("rejects with 'not implemented' when sending a GET request", async () => {
    const client = new FetchHttpClient();

    await expect(client.send({ method: "GET", path: "/workspaces" })).rejects.toThrow(
      "not implemented"
    );
  });

  it("rejects with 'not implemented' when sending a POST request with a body", async () => {
    const client = new FetchHttpClient();

    await expect(
      client.send({ method: "POST", path: "/workspaces", body: { name: "acme" } })
    ).rejects.toThrow("not implemented");
  });
});
