import type { PrincipalRole } from "@/application/ports/auth-session-port";

/**
 * The role-aware shell's navigation (owner decision D9, 2026-10-02), React-free.
 *
 * Signed out shows the public header of `Vaqcrow Landing.dc.html`; INVERSOR
 * and PYME follow the owner's menus. Routes are always in English; in-page
 * anchors are Spanish (#como-funciona, #limites — owner decision, 2026-10-10).
 * Links to pages that do not exist yet (`/about`, the guides, `/reports`) are
 * shown on purpose — the owner accepted a 404 until #394/#430/#418 build them.
 * (`/explore` is now built by #414.) No view ever links to `/admin`.
 */
export interface ShellLink {
  readonly label: string;
  readonly href: string;
}

/** Icon keys for the avatar menu (template: pie-chart, book, document-text, help-circle). */
export type ShellMenuIcon = "portfolio" | "guide" | "reports" | "help";

export interface ShellMenuLink extends ShellLink {
  readonly icon: ShellMenuIcon;
}

/** Icon keys for the role chip (template: person-outline, storefront-outline). */
export type RoleChipIcon = "person" | "storefront" | "shield";

export interface ShellView {
  readonly nav: readonly ShellLink[];
  /** Avatar-menu links; "Cerrar sesión" always follows them for a signed-in principal. */
  readonly menu: readonly ShellMenuLink[];
  readonly chip: { readonly label: string; readonly icon: RoleChipIcon } | null;
  /** Role avatar from the template (`assets/avatar-*.png`, copied to `public/`). */
  readonly avatarSrc: string | null;
}

export const SIGN_IN_LINK: ShellLink = Object.freeze({ label: "Ingresar", href: "/login" });
export const SIGN_UP_LINK: ShellLink = Object.freeze({ label: "Crear cuenta", href: "/signup" });
export const SIGN_OUT_LABEL = "Cerrar sesión";
/** Shown next to the account menu when signing out fails (owner-visible assumption; not in the template). */
export const SIGN_OUT_ERROR = "No pudimos cerrar la sesión. Volvé a intentar.";

/**
 * The fixed header's Testnet badge, as `Vaqcrow Landing.dc.html` and
 * `Vaqcrow Portafolio.dc.html` write it. `demo-ui.md` §2 asks for a `TESTNET`
 * badge in the fixed header; the full canonical `microcopy.testnetBadge`
 * ("TESTNET · Activos sin valor económico") stays in the page footer.
 */
export const HEADER_TESTNET_BADGE = "TESTNET";

export function accountMenuLabel(displayName: string): string {
  return `Menú de cuenta de ${displayName}`;
}

const EXPLORE: ShellLink = { label: "Explorar PyMEs", href: "/explore" };
const HOW_IT_WORKS: ShellLink = { label: "Cómo funciona", href: "/#como-funciona" };
/**
 * Owner decision, 2026-10-15 (#558): every role's nav links the Blog, always
 * right before «Acerca de». The template does not draw this entry.
 */
const BLOG: ShellLink = { label: "Blog", href: "/blog" };
const ABOUT: ShellLink = { label: "Acerca de", href: "/about" };
/**
 * Avatar-menu entry (Feature #394 / WU5): `Vaqcrow Landing.dc.html:70`, placed
 * before sign-out. The template draws a help-circle glyph
 * (`help-circle-outline`), which the presenter's `MENU_ICONS` map renders from
 * the dedicated `"help"` key.
 */
const HELP: ShellMenuLink = { label: "Centro de ayuda", href: "/help", icon: "help" };

const view = (shell: ShellView): ShellView => Object.freeze(shell);

const PUBLIC_VIEW: ShellView = view({
  nav: Object.freeze([
    EXPLORE,
    HOW_IT_WORKS,
    { label: "Para emprendedores", href: "/entrepreneur-guide" },
    // Owner decision, 2026-10-13 (#500): a visitor reaches the investor guide as
    // easily as the entrepreneur one. The template does not draw this entry, and
    // it only fits because the theme control collapsed into a menu that same day.
    { label: "Guía del inversor", href: "/investor-guide" },
    BLOG,
    ABOUT
  ]),
  menu: Object.freeze([]),
  chip: null,
  avatarSrc: null
});

const VIEWS: Readonly<Record<PrincipalRole, ShellView>> = Object.freeze({
  INVERSOR: view({
    nav: Object.freeze([EXPLORE, { label: "Mi portafolio", href: "/portfolio" }, BLOG, ABOUT]),
    menu: Object.freeze([
      { label: "Mi portafolio", href: "/portfolio", icon: "portfolio" },
      { label: "Guía del inversor", href: "/investor-guide", icon: "guide" },
      { label: "Informes", href: "/reports", icon: "reports" },
      HELP
    ] as const),
    chip: { label: "INVERSOR", icon: "person" },
    avatarSrc: "/avatar-inversor.png"
  }),
  PYME: view({
    nav: Object.freeze([{ label: "Mi campaña", href: "/company" }, HOW_IT_WORKS, BLOG, ABOUT]),
    menu: Object.freeze([
      { label: "Mi campaña", href: "/company", icon: "portfolio" },
      { label: "Guía del emprendedor", href: "/entrepreneur-guide", icon: "guide" },
      HELP
    ] as const),
    chip: { label: "PYME", icon: "storefront" },
    avatarSrc: "/avatar-pyme.png"
  }),
  // Not designed by the template (owner assumption): an admin who lands on
  // the public site sees the public nav and can only sign out from here.
  ADMIN: view({
    nav: PUBLIC_VIEW.nav,
    menu: Object.freeze([]),
    chip: { label: "ADMIN", icon: "shield" },
    avatarSrc: null
  })
});

export function shellViewFor(role: PrincipalRole | null): ShellView {
  return role ? VIEWS[role] : PUBLIC_VIEW;
}

/** A nav item is current when its path is the visited one; fragment links never are. */
export function isCurrentPath(href: string, pathname: string): boolean {
  if (href.includes("#")) return false;
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return href === normalized;
}

/**
 * A nav item is current when its target is the visited one. A route link matches
 * the path ({@link isCurrentPath}); a fragment link — `/#como-funciona`, the
 * landing's in-page section — is current only when the path **and** the hash
 * match, so selecting it highlights the item exactly like a route does (owner
 * request, 2026-10-13, #514). The URL stays the state: there is no scroll-spy, so
 * merely scrolling to the section does not select it.
 */
export function isCurrentLink(href: string, pathname: string, hash: string): boolean {
  const hashAt = href.indexOf("#");
  if (hashAt === -1) return isCurrentPath(href, pathname);

  const path = href.slice(0, hashAt);
  return isCurrentPath(path.length > 0 ? path : pathname, pathname) && href.slice(hashAt) === hash;
}

/**
 * Title and subtitle of each role's home, verbatim from `Vaqcrow
 * Portafolio.dc.html` (`pageTitle` / `pageSubtitle`, investor and PyME modes).
 */
export const ROLE_HOME_COPY = Object.freeze({
  INVERSOR: Object.freeze({
    title: "Mi portafolio",
    subtitle:
      "Tus aportes a bóvedas de campañas sintéticas en Stellar Testnet. Los fondos los custodia cada contrato, no una persona."
  }),
  PYME: Object.freeze({
    title: "Mi campaña",
    subtitle:
      "Estado de la bóveda de tu campaña y las distribuciones que tenés que firmar. Todo corre en Stellar Testnet con datos sintéticos.",
    /** Shown while the PyME has no registered company (the wizard is #398). */
    registerCompany: "Registrar mi PyME"
  })
});
