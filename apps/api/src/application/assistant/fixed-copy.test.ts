import { describe, expect, it } from "vitest";

import { ASSISTANT_ACCOUNT_COPY, ASSISTANT_NO_DOCUMENTATION_COPY } from "./fixed-copy.js";

/**
 * The two fixed answers that send the user to support name the support channel
 * (owner, 2026-10-17): the same address «Acerca de», the help centre and the
 * Terms already publish.
 */
describe("assistant fixed copy — support channel", () => {
  it("names contact@vaqcrow.com in the no-documentation answer", () => {
    expect(ASSISTANT_NO_DOCUMENTATION_COPY).toBe(
      "No tengo documentación sobre eso. Podés leer las guías y el Blog, o escribir a soporte: contact@vaqcrow.com."
    );
  });

  it("names contact@vaqcrow.com in the account answer", () => {
    expect(ASSISTANT_ACCOUNT_COPY).toBe(
      "La información de tu cuenta está en tus informes. Si no lo encontrás ahí, escribí a soporte: contact@vaqcrow.com."
    );
  });
});
