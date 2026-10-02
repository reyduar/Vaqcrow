import { describe, expect, it } from "vitest";
import { FakeAuthSession } from "@/test/fake-auth-session";
import { createSessionStore } from "./session-store";

const ANA = { email: "ana@example.test", password: "secret-123", role: "INVERSOR", displayName: "Ana Pérez" } as const;

describe("createSessionStore", () => {
  it("starts loading with no principal", () => {
    const store = createSessionStore(new FakeAuthSession());
    expect(store.getState()).toMatchObject({ status: "loading", principal: null, error: null });
  });

  it("refresh resolves signed-out when there is no session", async () => {
    const store = createSessionStore(new FakeAuthSession());
    await store.getState().refresh();
    expect(store.getState()).toMatchObject({ status: "signed-out", principal: null, error: null });
  });

  it("refresh resolves signed-in with role and display name only", async () => {
    const fake = new FakeAuthSession();
    fake.seedAccount(ANA);
    await fake.signIn({ email: ANA.email, password: ANA.password });
    const store = createSessionStore(fake);

    await store.getState().refresh();

    expect(store.getState().status).toBe("signed-in");
    expect(store.getState().principal).toEqual({ role: "INVERSOR", displayName: "Ana Pérez" });
    expect(JSON.stringify(store.getState())).not.toContain("example.test");
  });

  it("refresh falls back to signed-out and records the code when the profile cannot be read", async () => {
    const fake = new FakeAuthSession();
    fake.failNext("getSession", "unavailable");
    const store = createSessionStore(fake);
    await store.getState().refresh();
    expect(store.getState()).toMatchObject({ status: "signed-out", principal: null, error: "unavailable" });
  });

  it("signIn moves to signed-in and returns the principal for the role redirect", async () => {
    const fake = new FakeAuthSession();
    fake.seedAccount({ ...ANA, role: "PYME", displayName: "Panadería Horizonte" });
    const store = createSessionStore(fake);

    const result = await store.getState().signIn({ email: ANA.email, password: ANA.password });

    expect(result).toEqual({ ok: true, principal: { role: "PYME", displayName: "Panadería Horizonte" } });
    expect(store.getState()).toMatchObject({ status: "signed-in", error: null });
  });

  it.each([
    ["wrong password", { password: "nope" }, "invalid_credentials"],
    ["unconfirmed email", { confirmed: false }, "email_not_confirmed"]
  ] as const)("signIn returns a sanitized code for a %s and stays signed-out", async (_label, patch, code) => {
    const fake = new FakeAuthSession();
    fake.seedAccount({ ...ANA, confirmed: "confirmed" in patch ? patch.confirmed : true });
    const store = createSessionStore(fake);
    await store.getState().refresh();

    const result = await store
      .getState()
      .signIn({ email: ANA.email, password: "password" in patch ? patch.password : ANA.password });

    expect(result).toEqual({ ok: false, code });
    expect(store.getState().status).toBe("signed-out");
  });

  it("signIn reports network failures as a code", async () => {
    const fake = new FakeAuthSession();
    fake.failNext("signIn", "network");
    const result = await createSessionStore(fake).getState().signIn({ email: ANA.email, password: ANA.password });
    expect(result).toEqual({ ok: false, code: "network" });
  });

  it("signUp returns confirmation_required and keeps the session signed-out", async () => {
    const fake = new FakeAuthSession();
    const store = createSessionStore(fake);
    await store.getState().refresh();

    const result = await store.getState().signUp({ role: "INVERSOR", displayName: "Ana Pérez", email: ANA.email, password: "p" });

    expect(result).toEqual({ ok: true, status: "confirmation_required" });
    expect(store.getState().status).toBe("signed-out");
    expect(fake.signUps).toEqual([{ role: "INVERSOR", displayName: "Ana Pérez", email: ANA.email }]);
  });

  it("signUp returns invalid_input for a short display name", async () => {
    const result = await createSessionStore(new FakeAuthSession())
      .getState()
      .signUp({ role: "PYME", displayName: "A", email: ANA.email, password: "p" });
    expect(result).toEqual({ ok: false, code: "invalid_input" });
  });

  it("signOut moves to signed-out", async () => {
    const fake = new FakeAuthSession();
    fake.seedAccount(ANA);
    const store = createSessionStore(fake);
    await store.getState().signIn({ email: ANA.email, password: ANA.password });

    expect(await store.getState().signOut()).toEqual({ ok: true });
    expect(store.getState()).toMatchObject({ status: "signed-out", principal: null });
  });

  it("signOut keeps the session and returns the code when it fails", async () => {
    const fake = new FakeAuthSession();
    fake.seedAccount(ANA);
    const store = createSessionStore(fake);
    await store.getState().signIn({ email: ANA.email, password: ANA.password });
    fake.failNext("signOut", "network");

    expect(await store.getState().signOut()).toEqual({ ok: false, code: "network" });
    expect(store.getState().status).toBe("signed-in");
  });

  it("a stale refresh never overwrites a newer result", async () => {
    const fake = new FakeAuthSession();
    fake.seedAccount(ANA);
    const store = createSessionStore(fake);
    const release = fake.holdNextGetSession();
    const stale = store.getState().refresh();

    await store.getState().signIn({ email: ANA.email, password: ANA.password });
    // The held read started while signed out; it resolves after the sign-in.
    release();
    await stale;

    expect(store.getState().status).toBe("signed-in");
  });

  it.each([
    ["signIn", "invalid_credentials"],
    ["signOut", "network"]
  ] as const)("a failed %s during the initial read never strands loading", async (operation, code) => {
    const fake = new FakeAuthSession();
    fake.seedAccount(ANA);
    const store = createSessionStore(fake);
    const release = fake.holdNextGetSession();
    const initial = store.getState().refresh();

    fake.failNext(operation, code);
    const result =
      operation === "signIn"
        ? await store.getState().signIn({ email: ANA.email, password: ANA.password })
        : await store.getState().signOut();
    release();
    await initial;

    expect(result).toEqual({ ok: false, code });
    expect(store.getState()).toMatchObject({ status: "signed-out", principal: null });
  });

  it.each(["network", "unavailable"] as const)(
    "a transient %s refresh failure keeps the signed-in principal and records the code",
    async (code) => {
      const fake = new FakeAuthSession();
      fake.seedAccount(ANA);
      const store = createSessionStore(fake);
      await store.getState().signIn({ email: ANA.email, password: ANA.password });

      fake.failNext("getSession", code);
      await store.getState().refresh();

      expect(store.getState()).toMatchObject({
        status: "signed-in",
        principal: { role: "INVERSOR", displayName: "Ana Pérez" },
        error: code
      });
    }
  );

  it("only an explicit signed-out snapshot signs out a signed-in store", async () => {
    const fake = new FakeAuthSession();
    fake.seedAccount(ANA);
    const store = createSessionStore(fake);
    await store.getState().signIn({ email: ANA.email, password: ANA.password });
    fake.failNext("getSession", "network");
    await store.getState().refresh();

    await fake.signOut();
    await store.getState().refresh();

    expect(store.getState()).toMatchObject({ status: "signed-out", principal: null, error: null });
  });
});
