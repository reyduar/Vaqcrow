import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { NotificationItem, NotificationPort } from "@/application/ports/notification-port";
import { NotificationBell } from "./notification-bell";

/**
 * A fresh SWR provider per render keeps each case on its own cache; without it
 * the module-level cache carries a successful `notifications` result into later
 * cases, so a failing port would never be fetched.
 */
const SWR_ISOLATED = { provider: () => new Map(), dedupingInterval: 0 } as const;

function renderIsolated(port: NotificationPort) {
  return render(
    <SWRConfig value={SWR_ISOLATED}>
      <NotificationBell port={port} />
    </SWRConfig>
  );
}

function todayAt(hours: number, minutes: number): string {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

const UNREAD: NotificationItem = {
  id: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10",
  recipientUserId: "00000000-0000-4000-8000-000000000000",
  eventKey: "contribution:1",
  eventType: "investor.contribution_confirmed",
  title: "Tu aporte se confirmó",
  body: "Tu aporte quedó registrado en Stellar Testnet.",
  ctaLabel: "Ver mi portafolio",
  ctaHref: "/portfolio",
  readAt: null,
  createdAt: todayAt(9, 42)
};

const READ: NotificationItem = {
  id: "9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d",
  recipientUserId: "00000000-0000-4000-8000-000000000000",
  eventKey: "goal:1",
  eventType: "investor.goal_reached",
  title: "La campaña que apoyás alcanzó la meta",
  body: "La bóveda alcanzó la meta.",
  ctaLabel: null,
  ctaHref: null,
  readAt: "2026-10-04T08:00:00.000Z",
  createdAt: todayAt(8, 10)
};

function fakePort(notifications: readonly NotificationItem[] = [UNREAD, READ]) {
  const unread = notifications.filter((entry) => entry.readAt === null).length;
  const list = vi.fn().mockResolvedValue({ ok: true, notifications });
  const countUnread = vi.fn().mockResolvedValue({ ok: true, unread });
  const markRead = vi.fn().mockResolvedValue({ ok: true });
  const markAllRead = vi.fn().mockResolvedValue({ ok: true, updated: unread });
  const port: NotificationPort = { list, countUnread, markRead, markAllRead };
  return { port, list, countUnread, markRead, markAllRead };
}

async function renderBell(port: NotificationPort) {
  const view = renderIsolated(port);
  const bell = await screen.findByRole("button", { name: /^Notificaciones, \d+ sin leer$/ });
  return { view, bell };
}

describe("NotificationBell", () => {
  it("announces the unread count in the label and shows the badge", async () => {
    const { port } = fakePort();
    const { bell } = await renderBell(port);

    expect(bell).toHaveAttribute("aria-label", "Notificaciones, 1 sin leer");
    expect(bell).toHaveAttribute("aria-expanded", "false");
    expect(bell).toHaveAttribute("aria-haspopup", "dialog");
    expect(within(bell).getByText("1")).toBeInTheDocument();
  });

  it("opens the dialog with the template header, the NUEVA tag and the time", async () => {
    const { port } = fakePort();
    const { bell } = await renderBell(port);

    fireEvent.click(bell);

    const dialog = screen.getByRole("dialog", { name: "Notificaciones" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText("1 sin leer")).toBeInTheDocument();
    expect(within(dialog).getByText("NUEVA")).toBeInTheDocument();
    expect(within(dialog).getByText("Hoy · 09:42")).toBeInTheDocument();
    // Focus moves into the dialog on open.
    expect(within(dialog).getByRole("button", { name: "Cerrar" })).toHaveFocus();
  });

  it("marks one notification read when its row expands", async () => {
    const { port, markRead } = fakePort();
    const { bell } = await renderBell(port);
    fireEvent.click(bell);
    const dialog = screen.getByRole("dialog", { name: "Notificaciones" });

    const row = within(dialog).getByRole("button", { name: /Tu aporte se confirmó/ });
    expect(row).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(row);

    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(markRead).toHaveBeenCalledWith(UNREAD.id);
    expect(within(dialog).getByText("Tu aporte quedó registrado en Stellar Testnet.")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Ver mi portafolio" })).toHaveAttribute("href", "/portfolio");

    await waitFor(() => expect(within(dialog).queryByText("NUEVA")).not.toBeInTheDocument());
    expect(within(dialog).getByText("Todo leído")).toBeInTheDocument();
    expect(bell).toHaveAttribute("aria-label", "Notificaciones, 0 sin leer");
  });

  it("marks every notification read from the footer", async () => {
    const { port, markAllRead } = fakePort();
    const { bell } = await renderBell(port);
    fireEvent.click(bell);
    const dialog = screen.getByRole("dialog", { name: "Notificaciones" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Marcar todas como leídas" }));

    expect(markAllRead).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(bell).toHaveAttribute("aria-label", "Notificaciones, 0 sin leer"));
    expect(within(dialog).queryByText("NUEVA")).not.toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the bell", async () => {
    const { port } = fakePort();
    const { bell } = await renderBell(port);
    fireEvent.click(bell);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(bell).toHaveFocus();
  });

  it("closes on an overlay click and on the close button, returning focus to the bell", async () => {
    const { port } = fakePort();
    const { bell } = await renderBell(port);
    fireEvent.click(bell);
    const dialog = screen.getByRole("dialog");

    fireEvent.click(dialog.parentElement as HTMLElement);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(bell).toHaveFocus();

    fireEvent.click(bell);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(bell).toHaveFocus();
  });

  it("shows `Todo leído` with no badge when there is nothing unread", async () => {
    const { port } = fakePort([READ]);
    const { bell } = await renderBell(port);

    expect(bell).toHaveAttribute("aria-label", "Notificaciones, 0 sin leer");
    expect(within(bell).queryByText("0")).not.toBeInTheDocument();

    fireEvent.click(bell);
    const dialog = screen.getByRole("dialog", { name: "Notificaciones" });
    expect(within(dialog).getByText("Todo leído")).toBeInTheDocument();
    expect(within(dialog).queryByText("NUEVA")).not.toBeInTheDocument();
  });

  it("surfaces the load failure instead of claiming an empty inbox", async () => {
    const port: NotificationPort = {
      list: vi.fn().mockResolvedValue({ ok: false, code: "network" }),
      countUnread: vi.fn().mockResolvedValue({ ok: true, unread: 0 }),
      markRead: vi.fn().mockResolvedValue({ ok: false, code: "unavailable" }),
      markAllRead: vi.fn().mockResolvedValue({ ok: false, code: "unavailable" })
    };

    renderIsolated(port);

    const bell = await screen.findByRole("button", { name: "Notificaciones no disponibles" });
    expect(bell).not.toHaveAttribute("aria-label", "Notificaciones, 0 sin leer");

    fireEvent.click(bell);
    const dialog = screen.getByRole("dialog", { name: "Notificaciones" });
    expect(within(dialog).getByText("No pudimos cargar tus notificaciones.")).toBeInTheDocument();
    expect(within(dialog).queryByText("Todo leído")).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/\d+ sin leer/)).not.toBeInTheDocument();
  });
});
