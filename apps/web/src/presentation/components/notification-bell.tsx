"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { IoChevronDownOutline, IoChevronUpOutline, IoCloseOutline, IoNotificationsOutline } from "react-icons/io5";
import type { NotificationItem, NotificationPort } from "@/application/ports/notification-port";
import { createBrowserNotificationPort } from "@/infrastructure/notifications/create-notification-port";
import { useNotifications } from "@/state/use-notifications";

/**
 * The notification bell and modal of `Vaqcrow Admin.dc.html` (Feature #382,
 * Task #383 / T1d), mounted in the role-aware header for PYME and INVERSOR.
 *
 * The template draws the bell only in the Admin shell; the owner decided
 * (2026-10-04) to replicate it verbatim for the signed-in public header, and
 * the Admin mount waits for #386. The caller decides the role: this component
 * renders for whoever mounts it.
 *
 * Faithful to the template markup and its accessibility: the button is
 * `aria-label="Notificaciones, N sin leer"` (the count is announced, so the
 * badge itself is `aria-hidden`), the dialog is `role="dialog" aria-modal` with
 * `aria-labelledby`, each row is an accordion (`aria-expanded`) with the
 * `NUEVA` tag while unread, and "Marcar todas como leídas" closes the list.
 * Opening moves focus to the close control; Escape and the overlay close it and
 * focus returns to the bell. Expanding a row marks it read optimistically.
 *
 * The per-row icon is the generic notifications glyph: the API contract carries
 * no icon field, and the template's four Admin icons do not cover the other
 * roles' events, so inventing a mapping is avoided.
 */

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/**
 * The template's time column: `Hoy · 09:42`, `Ayer · 17:30`, else `12/09 · 18:02`.
 * Local time; an unparseable timestamp renders nothing rather than an invalid date.
 */
export function formatNotificationTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  if (isSameDay(date, now)) return `Hoy · ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return `Ayer · ${time}`;

  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)} · ${time}`;
}

export interface NotificationBellProps {
  /**
   * The port to read and mutate. Tests inject a fake; production omits it and
   * the browser default (a null object when no API base URL is configured) is
   * built once.
   */
  readonly port?: NotificationPort;
}

export function NotificationBell({ port }: NotificationBellProps = {}) {
  const [resolvedPort] = useState<NotificationPort>(() => port ?? createBrowserNotificationPort());
  const { notifications, unread, markRead, markAllRead } = useNotifications(resolvedPort);

  const [isOpen, setIsOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setIsOpen(false);
    setOpenId(null);
    if (returnFocus) bellRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  function toggleItem(item: NotificationItem) {
    const willExpand = openId !== item.id;
    setOpenId(willExpand ? item.id : null);
    if (willExpand && item.readAt === null) void markRead(item.id);
  }

  return (
    <>
      <button
        ref={bellRef}
        type="button"
        aria-label={`Notificaciones, ${unread} sin leer`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className={`relative grid size-11 place-items-center rounded-control border border-border bg-transparent text-text-primary hover:bg-page-surface ${FOCUS_RING}`}
      >
        <IoNotificationsOutline aria-hidden="true" focusable="false" className="text-xl" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 inline-grid h-[18px] min-w-[18px] place-items-center rounded-pill bg-brand-accent px-1 text-[11px] font-bold text-on-accent"
          >
            {unread}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(17,17,17,0.55)] p-4"
          onClick={() => close(true)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-panel bg-raised shadow-[0_24px_48px_-12px_rgba(0,0,0,0.4)]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-6 py-5">
              <div>
                <h2 id={titleId} className="m-0 text-xl font-bold text-text-primary">
                  Notificaciones
                </h2>
                <div className="text-[13px] text-text-secondary">{unread > 0 ? `${unread} sin leer` : "Todo leído"}</div>
              </div>
              <button
                ref={closeRef}
                type="button"
                aria-label="Cerrar"
                onClick={() => close(true)}
                className={`grid size-11 place-items-center rounded-control bg-transparent text-text-primary hover:bg-page-surface ${FOCUS_RING}`}
              >
                <IoCloseOutline aria-hidden="true" focusable="false" className="text-[22px]" />
              </button>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto p-3.5">
              {notifications.map((item) => {
                const isUnread = item.readAt === null;
                const isExpanded = openId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`rounded-[14px] border border-border ${isExpanded ? "bg-page-surface" : "bg-transparent"}`}
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => toggleItem(item)}
                      className={`flex w-full cursor-pointer items-start gap-3 border-0 bg-transparent p-3.5 text-left text-text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring`}
                    >
                      <IoNotificationsOutline
                        aria-hidden="true"
                        focusable="false"
                        className="mt-px shrink-0 text-xl text-text-secondary"
                      />
                      <span className="flex-1">
                        <span className={`flex items-center gap-2 text-[15px] ${isUnread ? "font-bold" : "font-medium"}`}>
                          {item.title}
                          {isUnread ? (
                            <span className="rounded-pill bg-brand-accent px-1.5 py-0.5 text-[10px] font-bold tracking-[0.05em] text-on-accent">
                              NUEVA
                            </span>
                          ) : null}
                        </span>
                        <span className="block text-xs text-text-secondary">
                          {formatNotificationTime(item.createdAt)}
                        </span>
                      </span>
                      {isExpanded ? (
                        <IoChevronUpOutline
                          aria-hidden="true"
                          focusable="false"
                          className="mt-px shrink-0 text-lg text-text-secondary"
                        />
                      ) : (
                        <IoChevronDownOutline
                          aria-hidden="true"
                          focusable="false"
                          className="mt-px shrink-0 text-lg text-text-secondary"
                        />
                      )}
                    </button>

                    {isExpanded ? (
                      <div className="pr-3.5 pb-3.5 pl-[46px] text-sm leading-[1.55] text-text-secondary">
                        {item.body}
                        {item.ctaLabel && item.ctaHref ? (
                          <div className="mt-2.5 flex gap-2">
                            <Link
                              href={item.ctaHref}
                              onClick={() => close(false)}
                              className="inline-flex h-9 items-center rounded-lg bg-brand-accent px-3 text-[13px] font-semibold text-on-accent no-underline hover:bg-brand-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                            >
                              {item.ctaLabel}
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border px-6 py-3.5">
              <button
                type="button"
                onClick={() => void markAllRead()}
                className={`cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-brand-accent-text hover:text-text-primary ${FOCUS_RING}`}
              >
                Marcar todas como leídas
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
