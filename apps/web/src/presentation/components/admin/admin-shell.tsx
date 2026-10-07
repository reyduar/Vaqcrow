"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { IoBriefcaseOutline, IoLogOutOutline, IoPeopleOutline } from "react-icons/io5";
import { ADMIN_CONSOLE_PATH } from "@/application/admin/admin-guard";
import { countQueueStates, DEFAULT_ADMIN_QUEUE_QUERY } from "@/application/admin/queue";
import { SIGN_OUT_ERROR } from "@/application/navigation/shell-nav";
import type { AdminQueuePort } from "@/application/ports/admin-queue-port";
import type { NotificationPort } from "@/application/ports/notification-port";
import { createBrowserAdminQueuePort } from "@/infrastructure/admin/create-admin-queue-port";
import { useAdminQueue } from "@/state/use-admin-queue";
import { useSession, useSessionStoreApi } from "@/state/session-store-provider";
import { Badge } from "../badge";
import { BrandIsotipo } from "../brand-isotipo";
import { NotificationBell } from "../notification-bell";
import { ThemeSwitcher } from "../theme-switcher";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

/** D3: the chip's role line is a role, never a job title the app does not collect. */
const ADMIN_ROLE_LINE = "Administrador";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

export interface AdminShellProps {
  readonly children?: ReactNode;
  /** Injected in tests; production builds the browser port once. */
  readonly queuePort?: AdminQueuePort;
  readonly bellPort?: NotificationPort;
}

/**
 * The admin console shell (`Vaqcrow Admin.dc.html`, view `isApp`): the brand
 * header "Vaqcrow Admin" + `TESTNET · DEMO`, the `PyMEs`/`Usuarios` nav, the
 * theme switcher, the notification bell with its unread count, the user chip
 * (name + `Administrador`, D3) and "Cerrar sesión".
 *
 * `Usuarios` is #390's view and is not built here: it renders as the designed
 * nav item but as an inert, disabled control, so the shell never ships a dead
 * link (it is not a full users screen either).
 *
 * The `PyMEs` badge shows the pending count of the queue's default first page.
 * The T1 listing exposes no per-state count, so this is the honest count of
 * the loaded default page, documented in the task log.
 */
export function AdminShell({ children, queuePort, bellPort }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSessionStoreApi();
  const principal = useSession((state) => state.principal);
  const [resolvedQueuePort] = useState<AdminQueuePort>(() => queuePort ?? createBrowserAdminQueuePort());
  const [signOutFailed, setSignOutFailed] = useState(false);
  const { page } = useAdminQueue(resolvedQueuePort, DEFAULT_ADMIN_QUEUE_QUERY);
  const pending = page ? countQueueStates(page.items).pending : 0;
  const displayName = principal?.displayName ?? "";

  const pymesActive = pathname === ADMIN_CONSOLE_PATH || pathname.startsWith(`${ADMIN_CONSOLE_PATH}/`);

  async function signOut() {
    setSignOutFailed(false);
    const result = await session.getState().signOut();
    if (result.ok) router.push("/admin");
    else setSignOutFailed(true);
  }

  return (
    <div className="flex min-h-screen flex-wrap bg-canvas text-text-primary">
      <aside className="flex max-w-full flex-1 basis-[248px] flex-col gap-5 self-stretch border-b border-r border-page-border bg-page-surface p-5">
        <div className="flex items-center gap-2.5 px-2">
          <BrandIsotipo />
          <div>
            <div className="text-[17px] font-bold">Vaqcrow Admin</div>
            <div className="text-[11px] tracking-[0.04em] text-text-secondary">TESTNET · DEMO</div>
          </div>
        </div>

        <nav aria-label="Administración" className="flex flex-col gap-1">
          <Link
            href={ADMIN_CONSOLE_PATH}
            aria-current={pymesActive ? "page" : undefined}
            className={`flex h-11 items-center gap-3 rounded-control px-3 text-[15px] no-underline ${FOCUS_RING} ${
              pymesActive
                ? "bg-brand-accent-tint font-[650] text-brand-accent-text"
                : "font-medium text-text-primary hover:bg-page-surface"
            }`}
          >
            <IoBriefcaseOutline aria-hidden="true" focusable="false" className="shrink-0 text-xl" />
            <span className="flex-1">PyMEs</span>
            {pending > 0 ? (
              <span
                aria-hidden="true"
                className="inline-grid h-[22px] min-w-[22px] place-items-center rounded-pill bg-brand-accent px-1.5 text-xs font-[650] text-on-accent"
              >
                {pending}
              </span>
            ) : null}
          </Link>

          <button
            type="button"
            disabled
            className="flex h-11 items-center gap-3 rounded-control px-3 text-left text-[15px] font-medium text-text-secondary opacity-70"
          >
            <IoPeopleOutline aria-hidden="true" focusable="false" className="shrink-0 text-xl" />
            <span className="flex-1">Usuarios</span>
          </button>
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-page-border pt-4">
          <ThemeSwitcher />
          <button
            type="button"
            onClick={() => void signOut()}
            className={`flex h-11 items-center gap-3 rounded-control px-3 text-left text-sm font-semibold text-trust-critical hover:bg-page-surface ${FOCUS_RING}`}
          >
            <IoLogOutOutline aria-hidden="true" focusable="false" className="shrink-0 text-[19px]" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-[999] basis-[480px] flex-col">
        <header className="flex flex-wrap items-center justify-end gap-3 border-b border-page-border px-[clamp(16px,4vw,32px)] py-3">
          <Badge variant="testnet" label="TESTNET" />
          <NotificationBell {...(bellPort ? { port: bellPort } : {})} />
          <div className="flex items-center gap-2.5 border-l border-page-border pl-3">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-pill bg-brand-accent-tint text-[13px] font-bold text-brand-accent-text"
            >
              {initialsOf(displayName)}
            </span>
            <div className="leading-tight">
              <div className="text-sm font-[650]">{displayName}</div>
              <div className="text-xs text-text-secondary">{ADMIN_ROLE_LINE}</div>
            </div>
          </div>
        </header>

        {signOutFailed ? (
          <p role="alert" className="m-0 px-[clamp(16px,4vw,32px)] pt-3 text-sm font-medium text-trust-critical">
            {SIGN_OUT_ERROR}
          </p>
        ) : null}

        <main className="flex w-full max-w-[1200px] flex-col gap-7 px-[clamp(16px,4vw,32px)] pt-8 pb-16">
          {children}
        </main>
      </div>
    </div>
  );
}
