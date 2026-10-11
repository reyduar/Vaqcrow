import type { IconType } from "react-icons";
import {
  IoAlertCircleOutline,
  IoAlertOutline,
  IoArrowForwardOutline,
  IoBarChartOutline,
  IoCalendarOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoConstructOutline,
  IoDocumentAttachOutline,
  IoEyeOutline,
  IoFlaskOutline,
  IoHelpCircleOutline,
  IoIdCardOutline,
  IoInformationCircleOutline,
  IoLockOpenOutline,
  IoPersonOutline,
  IoReceiptOutline,
  IoRemoveCircleOutline,
  IoReturnDownBackOutline,
  IoSchoolOutline,
  IoShieldOutline,
  IoStorefrontOutline,
  IoTrendingDownOutline,
  IoWarningOutline
} from "react-icons/io5";

/**
 * The guides' copy stores the template's Ionicons names as plain strings
 * (`application/guides/*` is React-free), so presentation owns the mapping to
 * `react-icons/io5` — the same module-level typed record pattern the repo uses
 * (`about/about-icons.ts`, `admin/admin-state-pill.tsx`). A section resolves a
 * glyph with a direct index, never a component-creating call during render
 * (which the React Compiler lint forbids).
 */
export type GuideIconName =
  | "id-card-outline"
  | "bar-chart-outline"
  | "document-attach-outline"
  | "checkmark-circle-outline"
  | "return-down-back-outline"
  | "eye-outline"
  | "calendar-outline"
  | "construct-outline"
  | "close-circle-outline"
  | "help-circle-outline"
  | "person-outline"
  | "information-circle-outline"
  | "arrow-forward-outline"
  | "receipt-outline"
  | "trending-down-outline"
  | "shield-outline"
  | "alert-outline"
  | "warning-outline"
  | "remove-circle-outline"
  | "alert-circle-outline"
  | "flask-outline"
  | "lock-open-outline"
  | "storefront-outline"
  | "school-outline";

export const GUIDE_ICONS: Readonly<Record<GuideIconName, IconType>> = Object.freeze({
  "id-card-outline": IoIdCardOutline,
  "bar-chart-outline": IoBarChartOutline,
  "document-attach-outline": IoDocumentAttachOutline,
  "checkmark-circle-outline": IoCheckmarkCircleOutline,
  "return-down-back-outline": IoReturnDownBackOutline,
  "eye-outline": IoEyeOutline,
  "calendar-outline": IoCalendarOutline,
  "construct-outline": IoConstructOutline,
  "close-circle-outline": IoCloseCircleOutline,
  "help-circle-outline": IoHelpCircleOutline,
  "person-outline": IoPersonOutline,
  "information-circle-outline": IoInformationCircleOutline,
  "arrow-forward-outline": IoArrowForwardOutline,
  "receipt-outline": IoReceiptOutline,
  "trending-down-outline": IoTrendingDownOutline,
  "shield-outline": IoShieldOutline,
  "alert-outline": IoAlertOutline,
  "warning-outline": IoWarningOutline,
  "remove-circle-outline": IoRemoveCircleOutline,
  "alert-circle-outline": IoAlertCircleOutline,
  "flask-outline": IoFlaskOutline,
  "lock-open-outline": IoLockOpenOutline,
  "storefront-outline": IoStorefrontOutline,
  "school-outline": IoSchoolOutline
});
