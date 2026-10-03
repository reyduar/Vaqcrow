"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { IconType } from "react-icons";
import {
  IoBookOutline,
  IoDocumentTextOutline,
  IoLogOutOutline,
  IoPersonOutline,
  IoPieChartOutline,
  IoShieldCheckmarkOutline,
  IoStorefrontOutline
} from "react-icons/io5";
import {
  accountMenuLabel,
  isCurrentPath,
  shellViewFor,
  SIGN_IN_LINK,
  SIGN_OUT_LABEL,
  SIGN_UP_LINK,
  type RoleChipIcon,
  type ShellMenuIcon
} from "@/application/navigation/shell-nav";
import { useSession, useSessionStoreApi } from "@/state/session-store-provider";
import { AccountMenu, type AccountMenuItem } from "./account-menu";
import { DemoNavbar } from "./demo-navbar";
import { ThemeSwitcher } from "./theme-switcher";

const MENU_ICONS: Readonly<Record<ShellMenuIcon, IconType>> = {
  portfolio: IoPieChartOutline,
  guide: IoBookOutline,
  reports: IoDocumentTextOutline
};

const CHIP_ICONS: Readonly<Record<RoleChipIcon, IconType>> = {
  person: IoPersonOutline,
  storefront: IoStorefrontOutline,
  shield: IoShieldCheckmarkOutline
};

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

/**
 * The role-aware header (owner decision D9): the public header of
 * `Vaqcrow Landing.dc.html` while signed out, and the `Vaqcrow
 * Portafolio.dc.html` header with the role avatar menu while signed in. It
 * reads the real session store; the role comes from the verified profile.
 *
 * While the session is still loading the right end shows only the theme
 * switcher, so neither the auth buttons nor the avatar flash. The email is
 * never rendered (the principal does not even carry it). "Cerrar sesión"
 * calls the store's real sign-out and then navigates home; if signing out
 * fails, the header keeps showing the session that is still open.
 */
export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSessionStoreApi();
  const status = useSession((state) => state.status);
  const principal = useSession((state) => state.principal);
  const view = shellViewFor(principal?.role ?? null);

  const items = view.nav.map((link) => ({
    label: link.label,
    href: link.href,
    ...(isCurrentPath(link.href, pathname) ? { current: true } : {})
  }));

  async function signOut() {
    await session.getState().signOut();
    router.push("/");
  }

  let account = null;
  if (status === "signed-in" && principal) {
    const menuItems: AccountMenuItem[] = [
      ...view.menu.map((link) => ({ label: link.label, href: link.href, icon: MENU_ICONS[link.icon] })),
      { label: SIGN_OUT_LABEL, icon: IoLogOutOutline, separatorBefore: true, onSelect: () => void signOut() }
    ];
    account = (
      <AccountMenu
        variant="avatar"
        name={principal.displayName}
        triggerLabel={accountMenuLabel(principal.displayName)}
        {...(view.avatarSrc ? { avatarSrc: view.avatarSrc } : {})}
        {...(view.chip ? { roleChip: { label: view.chip.label, icon: CHIP_ICONS[view.chip.icon] } } : {})}
        items={menuItems}
      />
    );
  } else if (status === "signed-out") {
    account = (
      <>
        <Link
          href={SIGN_IN_LINK.href}
          className={`flex h-11 items-center rounded-control border border-control px-3.5 text-sm font-semibold text-text-primary no-underline hover:bg-page-surface ${FOCUS_RING}`}
        >
          {SIGN_IN_LINK.label}
        </Link>
        <Link
          href={SIGN_UP_LINK.href}
          className={`flex h-11 items-center rounded-control bg-brand-accent px-4 text-sm font-semibold text-on-accent no-underline hover:bg-brand-accent-hover ${FOCUS_RING}`}
        >
          {SIGN_UP_LINK.label}
        </Link>
      </>
    );
  }

  return (
    <DemoNavbar
      items={items}
      actions={
        <>
          <ThemeSwitcher />
          {account}
        </>
      }
    />
  );
}
