import { describe, expect, it } from "vitest";
import {
  accountMenuLabel,
  isCurrentPath,
  shellViewFor,
  SIGN_IN_LINK,
  SIGN_OUT_LABEL,
  SIGN_UP_LINK
} from "./shell-nav";

const pairs = (links: readonly { label: string; href: string }[]) => links.map(({ label, href }) => [label, href]);

describe("shellViewFor (owner decision D9)", () => {
  it("signed out: the public header and no account menu", () => {
    const view = shellViewFor(null);
    expect(pairs(view.nav)).toEqual([
      ["Explorar PyMEs", "/explore"],
      ["Cómo funciona", "/#how-it-works"],
      ["Para emprendedores", "/entrepreneur-guide"],
      ["Acerca de", "/about"]
    ]);
    expect(view.menu).toEqual([]);
    expect(view.chip).toBeNull();
    expect(view.avatarSrc).toBeNull();
  });

  it("INVERSOR: header nav, avatar menu, chip and avatar", () => {
    const view = shellViewFor("INVERSOR");
    expect(pairs(view.nav)).toEqual([
      ["Explorar PyMEs", "/explore"],
      ["Mi portafolio", "/portfolio"],
      ["Acerca de", "/about"]
    ]);
    expect(pairs(view.menu)).toEqual([
      ["Mi portafolio", "/portfolio"],
      ["Guía del inversor", "/investor-guide"],
      ["Informes", "/reports"]
    ]);
    expect(view.chip).toEqual({ label: "INVERSOR", icon: "person" });
    expect(view.avatarSrc).toBe("/avatar-inversor.png");
  });

  it("PYME: header nav, avatar menu, chip and avatar", () => {
    const view = shellViewFor("PYME");
    expect(pairs(view.nav)).toEqual([
      ["Mi campaña", "/company"],
      ["Cómo funciona", "/#how-it-works"],
      ["Acerca de", "/about"]
    ]);
    expect(pairs(view.menu)).toEqual([
      ["Mi campaña", "/company"],
      ["Guía del emprendedor", "/entrepreneur-guide"]
    ]);
    expect(view.chip).toEqual({ label: "PYME", icon: "storefront" });
    expect(view.avatarSrc).toBe("/avatar-pyme.png");
  });

  it("ADMIN: the public nav and a menu with sign-out only, never an /admin link", () => {
    const view = shellViewFor("ADMIN");
    expect(view.nav).toEqual(shellViewFor(null).nav);
    expect(view.menu).toEqual([]);
    expect(view.chip).toEqual({ label: "ADMIN", icon: "shield" });
  });

  it("no view links to /admin", () => {
    for (const role of [null, "INVERSOR", "PYME", "ADMIN"] as const) {
      const view = shellViewFor(role);
      for (const link of [...view.nav, ...view.menu]) expect(link.href.startsWith("/admin")).toBe(false);
    }
  });

  it("names the sign-in, sign-up and sign-out actions", () => {
    expect(SIGN_IN_LINK).toEqual({ label: "Ingresar", href: "/login" });
    expect(SIGN_UP_LINK).toEqual({ label: "Crear cuenta", href: "/signup" });
    expect(SIGN_OUT_LABEL).toBe("Cerrar sesión");
    expect(accountMenuLabel("Lucía Fernández")).toBe("Menú de cuenta de Lucía Fernández");
  });
});

describe("isCurrentPath", () => {
  it.each([
    ["/portfolio", "/portfolio", true],
    ["/portfolio", "/portfolio/", true],
    ["/portfolio", "/company", false],
    ["/explore", "/", false],
    ["/#how-it-works", "/", false]
  ] as const)("%s on %s → %s", (href, pathname, expected) => {
    expect(isCurrentPath(href, pathname)).toBe(expected);
  });
});
