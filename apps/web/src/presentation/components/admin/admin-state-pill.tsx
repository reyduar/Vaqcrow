import type { IconType } from "react-icons";
import {
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoCreateOutline,
  IoHourglassOutline
} from "react-icons/io5";
import type { QueueIcon, QueueStateCopy, QueueTone } from "@/application/admin/queue";

/**
 * The template's `ST` state badge (`Vaqcrow Admin.dc.html`), shared by the
 * PyMEs queue rows (`sm`, 24px) and the review header (`md`, 30px).
 */

export const ADMIN_ICONS: Readonly<Record<QueueIcon, IconType>> = {
  hourglass: IoHourglassOutline,
  create: IoCreateOutline,
  check: IoCheckmarkCircleOutline,
  close: IoCloseCircleOutline
};

export const ADMIN_TONE_TEXT: Readonly<Record<QueueTone, string>> = {
  caution: "text-trust-caution",
  info: "text-trust-info",
  success: "text-trust-success",
  critical: "text-trust-critical"
};

const TONE_SURFACE: Readonly<Record<QueueTone, string>> = {
  caution: "bg-trust-caution-surface text-trust-caution",
  info: "bg-trust-info-surface text-trust-info",
  success: "bg-trust-success-surface text-trust-success",
  critical: "bg-trust-critical-surface text-trust-critical"
};

const SIZE: Readonly<Record<"sm" | "md", { readonly pill: string; readonly icon: string }>> = {
  sm: { pill: "h-6 gap-1 px-2.5 text-xs font-semibold", icon: "text-[14px]" },
  md: { pill: "h-[30px] gap-[5px] px-3 text-[13px] font-[650]", icon: "text-base" }
};

export function AdminStatePill({ copy, size = "sm" }: { copy: QueueStateCopy; size?: "sm" | "md" }) {
  const Icon = ADMIN_ICONS[copy.icon];
  return (
    <span
      className={`inline-flex items-center rounded-pill whitespace-nowrap ${SIZE[size].pill} ${TONE_SURFACE[copy.tone]}`}
    >
      <Icon aria-hidden="true" focusable="false" className={SIZE[size].icon} />
      {copy.label}
    </span>
  );
}
