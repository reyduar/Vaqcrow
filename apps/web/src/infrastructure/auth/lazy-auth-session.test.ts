import { describe, expect, it, vi } from "vitest";
import { AuthSessionError } from "@/application/ports/auth-session-port";
import { FakeAuthSession } from "@/test/fake-auth-session";
import { createLazyAuthSession } from "./lazy-auth-session";

describe("createLazyAuthSession", () => {
  it("does not build the port until the first call", async () => {
    const factory = vi.fn(() => new FakeAuthSession());
    const port = createLazyAuthSession(factory);
    expect(factory).not.toHaveBeenCalled();

    await port.getSession();
    await port.getSession();

    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("delegates every call to the built port", async () => {
    const fake = new FakeAuthSession();
    fake.seedAccount({ email: "ana@example.test", password: "secret-123", role: "PYME", displayName: "Ana" });
    const port = createLazyAuthSession(() => fake);

    await expect(port.signIn({ email: "ana@example.test", password: "secret-123" })).resolves.toEqual({
      role: "PYME",
      displayName: "Ana"
    });
    await expect(port.getAccessToken()).resolves.toBe(fake.token);
    await port.clearLocalSession();
    expect(fake.localClears).toBe(1);
    await expect(port.getAccessToken()).resolves.toBeNull();
    const unsubscribe = port.onSessionChange(() => undefined);
    expect(fake.listenerCount).toBe(1);
    unsubscribe();
    expect(fake.listenerCount).toBe(0);
  });

  it("turns a missing configuration into sanitized, non-throwing failures", async () => {
    const port = createLazyAuthSession(() => {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
    });

    await expect(port.getSession()).rejects.toEqual(new AuthSessionError("unavailable"));
    await expect(port.signIn({ email: "a@b.co", password: "x" })).rejects.toBeInstanceOf(AuthSessionError);
    await expect(port.signUp({ role: "PYME", displayName: "Ana", email: "a@b.co", password: "x" })).rejects.toEqual(
      new AuthSessionError("unavailable")
    );
    await expect(port.signOut()).rejects.toEqual(new AuthSessionError("unavailable"));
    await expect(port.clearLocalSession()).rejects.toEqual(new AuthSessionError("unavailable"));
    await expect(port.getAccessToken()).resolves.toBeNull();
    expect(() => port.onSessionChange(() => undefined)()).not.toThrow();
  });
});
