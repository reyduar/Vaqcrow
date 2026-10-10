import type { IconType } from "react-icons";
import {
  IoAnalyticsOutline,
  IoArrowForwardOutline,
  IoCubeOutline,
  IoDocumentTextOutline,
  IoKeyOutline,
  IoLayersOutline,
  IoLogoDiscord,
  IoLogoGithub,
  IoLogoLinkedin,
  IoMailOutline,
  IoPersonOutline,
  IoReceiptOutline,
  IoSchoolOutline
} from "react-icons/io5";

/**
 * The `/about` copy stores the template's Ionicons names as plain strings
 * (`application/about/copy.ts` is React-free), so presentation owns the
 * mapping to `react-icons/io5`. These are module-level typed records — the
 * same shape the repo's other icon maps use (`admin/admin-state-pill.tsx`,
 * `transaction-status-list.tsx`) — so a section resolves its glyph with a
 * direct index (never a component-creating call during render, which the
 * React Compiler lint forbids).
 */
export type AboutIconName =
  | "analytics-outline"
  | "key-outline"
  | "cube-outline"
  | "receipt-outline"
  | "document-text-outline"
  | "person-outline"
  | "layers-outline"
  | "school-outline"
  | "arrow-forward-outline"
  | "logo-linkedin"
  | "logo-discord"
  | "mail-outline"
  | "logo-github";

export const ABOUT_ICONS: Readonly<Record<AboutIconName, IconType>> = Object.freeze({
  "analytics-outline": IoAnalyticsOutline,
  "key-outline": IoKeyOutline,
  "cube-outline": IoCubeOutline,
  "receipt-outline": IoReceiptOutline,
  "document-text-outline": IoDocumentTextOutline,
  "person-outline": IoPersonOutline,
  "layers-outline": IoLayersOutline,
  "school-outline": IoSchoolOutline,
  "arrow-forward-outline": IoArrowForwardOutline,
  "logo-linkedin": IoLogoLinkedin,
  "logo-discord": IoLogoDiscord,
  "mail-outline": IoMailOutline,
  "logo-github": IoLogoGithub
});

/** «Hablemos» rows are labelled in Spanish; map each label to its brand icon. */
export type AboutContactLabel = "LinkedIn" | "Discord" | "Email" | "GitHub";

export const ABOUT_CONTACT_ICONS: Readonly<Record<AboutContactLabel, IconType>> = Object.freeze({
  LinkedIn: IoLogoLinkedin,
  Discord: IoLogoDiscord,
  Email: IoMailOutline,
  GitHub: IoLogoGithub
});
