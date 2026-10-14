import type {
  AdminUserKycStatus,
  AdminUserRole,
  AdminUserStatus,
  AdminUsersPage,
  AdminUsersQuery,
  AuditLogPage,
  AuditLogQuery,
  ChangeUserRoleCommand,
  ChangeableUserRole,
  InviteOperatorCommand,
  InviteOperatorResult,
  SetChatAccessCommand,
  SetUserActiveCommand
} from "@vaqcrow/contracts";

/**
 * Pure model of the admin › Usuarios view (`Vaqcrow Admin.dc.html`, view
 * `users`), React-free. The presentation layer renders it; the adapter in
 * `infrastructure/admin/` supplies the data.
 *
 * It also owns the `AdminUsersPort` capability (Feature #390), because the
 * console's users surface is one cohesive concern: the users page, the audit
 * log and the three mutations. The port is vendor-free, exactly like
 * `application/ports/admin-queue-port.ts`; the HTTP adapter implements it.
 *
 * Owner decisions encoded here: the role vocabulary is English
 * (`PYME`/`INVERSOR`/`ADMIN`) and its Spanish label lives in `ROLE_LABEL`; a
 * role change only ever offers PYME ↔ INVERSOR (`roleChangeTarget`), never
 * `ADMIN`; the simulated KYC is a read-only badge (`KYC_COPY`, D3); an
 * `invited` account gets no activation control because the template designs no
 * row action for a pending invitation.
 */

/** The Usuarios route, sibling of `ADMIN_CONSOLE_PATH` (`/admin/pymes`). */
export const ADMIN_USERS_PATH = "/admin/users";

export const ADMIN_USERS_PAGE_SIZE = 20;

export const ADMIN_AUDIT_PAGE_SIZE = 10;

/** The API's declared absence for a field it could not provide. */
export const MISSING_LABEL = "Sin dato";

/** An account that has never been active; distinct from an unreadable date. */
export const NEVER_ACTIVE_LABEL = "Sin actividad";

export const DEFAULT_ADMIN_USERS_QUERY: AdminUsersQuery = Object.freeze({
  page: 1,
  pageSize: ADMIN_USERS_PAGE_SIZE
});

export const DEFAULT_ADMIN_AUDIT_QUERY: AuditLogQuery = Object.freeze({
  page: 1,
  pageSize: ADMIN_AUDIT_PAGE_SIZE
});

/** The label shown on the signed-in admin's own row in place of a toggle. */
export const SELF_ACCOUNT_LABEL = "Tu cuenta";

/** Spanish labels for the English role vocabulary; the wire value never changes. */
export const ROLE_LABEL: Readonly<Record<AdminUserRole, string>> = Object.freeze({
  PYME: "PyME",
  INVERSOR: "Inversor",
  ADMIN: "Administrador"
});

export interface UserStatusCopy {
  readonly label: string;
  readonly tone: "success" | "info" | "neutral";
}

/** The template's `Activo`/`Inactivo` plus the contract's `invited` state. */
export const USER_STATUS_COPY: Readonly<Record<AdminUserStatus, UserStatusCopy>> = Object.freeze({
  active: { label: "Activo", tone: "success" },
  inactive: { label: "Inactivo", tone: "neutral" },
  invited: { label: "Invitado", tone: "info" }
});

export interface KycCopy {
  readonly label: string;
  /** The `Badge` variant: `simulado` for the simulated approval, `fallback` otherwise. */
  readonly variant: "simulado" | "fallback";
}

/** Read-only KYC badge (D3); the approval is simulated and says so. */
export const KYC_COPY: Readonly<Record<AdminUserKycStatus, KycCopy>> = Object.freeze({
  not_started: { label: "KYC sin iniciar", variant: "fallback" },
  approved_simulated: { label: "KYC aprobado (simulado)", variant: "simulado" },
  not_applicable: { label: "KYC no aplica", variant: "fallback" }
});

/** The single role a role change offers, or `undefined` when no change is allowed. */
export function roleChangeTarget(role: AdminUserRole): ChangeableUserRole | undefined {
  switch (role) {
    case "PYME":
      return "INVERSOR";
    case "INVERSOR":
      return "PYME";
    default:
      return undefined;
  }
}

/** The action label for a row's role-change control, e.g. "Cambiar a Inversor". */
export function roleChangeLabel(target: ChangeableUserRole): string {
  return `Cambiar a ${ROLE_LABEL[target]}`;
}

export type UserActivationControl =
  | { readonly kind: "self"; readonly label: string }
  | { readonly kind: "toggle"; readonly label: string; readonly nextActive: boolean }
  | { readonly kind: "none" };

/**
 * The activation control for a row. The signed-in admin's own row never gets a
 * toggle (it reads "Tu cuenta"), and an `invited` account — whose invitation is
 * not yet accepted — gets none at all: the template designs no row action for
 * that state, and this boundary never invents one.
 */
export function userActivationControl(user: {
  readonly isSelf: boolean;
  readonly status: AdminUserStatus;
}): UserActivationControl {
  if (user.isSelf) return { kind: "self", label: SELF_ACCOUNT_LABEL };
  if (user.status === "active") return { kind: "toggle", label: "Desactivar", nextActive: false };
  if (user.status === "inactive") return { kind: "toggle", label: "Activar", nextActive: true };
  return { kind: "none" };
}

export interface ConfirmCopy {
  readonly title: string;
  readonly body: string;
}

/** The template's deactivation dialog, verbatim. */
export function deactivateConfirmCopy(displayName: string): ConfirmCopy {
  return {
    title: `Desactivar a ${displayName}`,
    body: "Pierde el acceso. Sus aportes y campañas no se modifican."
  };
}

/** The template's activation dialog, verbatim. */
export function activateConfirmCopy(displayName: string): ConfirmCopy {
  return {
    title: `Activar a ${displayName}`,
    body: "Vuelve a tener acceso a la demo."
  };
}

/** The role-change confirmation; the template designs no copy for it, so it states the outcome. */
export function roleChangeConfirmCopy(displayName: string, target: ChangeableUserRole): ConfirmCopy {
  return {
    title: `Cambiar rol de ${displayName}`,
    body: `Su cuenta pasa a ${ROLE_LABEL[target]}. El cambio queda auditado.`
  };
}

/**
 * The Acciones-cell control for the per-user assistant access flag (#499, D9):
 * the label reflects the real `chatEnabled` state and the button flips it.
 */
export function chatAccessControlLabel(chatEnabled: boolean): string {
  return chatEnabled ? "Deshabilitar asistente" : "Habilitar asistente";
}

/** The confirmation copy for the assistant-access toggle, mirroring the activation dialogs. */
export function chatAccessConfirmCopy(displayName: string, nextEnabled: boolean): ConfirmCopy {
  return {
    title: `${nextEnabled ? "Habilitar" : "Deshabilitar"} el asistente de ${displayName}`,
    body: nextEnabled
      ? "Va a poder preguntarle al asistente desde la landing y el centro de ayuda."
      : "Deja de ver el asistente. El resto de su cuenta no cambia."
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * `dd/mm/aaaa` for the last-activity column. A `null` timestamp is the honest
 * `Sin actividad`; an unreadable one degrades to `Sin dato`, never an invented
 * date.
 */
export function formatLastActivityAt(value: string | null): string {
  if (value === null) return NEVER_ACTIVE_LABEL;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return MISSING_LABEL;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** `dd/mm HH:MM` for the audit-log timestamp column. */
export function formatAuditTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return MISSING_LABEL;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Never reports zero pages, like the queue's `queueTotalPages`. */
export function totalPages(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Trims a search box for the wire; an empty box means no search parameter. */
export function searchOrUndefined(term: string): string | undefined {
  const trimmed = term.trim();
  return trimmed === "" ? undefined : trimmed.slice(0, 100);
}

/** Applies a search term and returns to the first page, preserving role/status. */
export function usersQueryWithSearch(query: AdminUsersQuery, term: string): AdminUsersQuery {
  const search = searchOrUndefined(term);
  return {
    page: 1,
    pageSize: query.pageSize,
    ...(query.role === undefined ? {} : { role: query.role }),
    ...(query.status === undefined ? {} : { status: query.status }),
    ...(search === undefined ? {} : { search })
  };
}

/** Sets or clears the role filter and returns to the first page. */
export function usersQueryWithRole(query: AdminUsersQuery, role: AdminUserRole | null): AdminUsersQuery {
  return {
    page: 1,
    pageSize: query.pageSize,
    ...(query.search === undefined ? {} : { search: query.search }),
    ...(query.status === undefined ? {} : { status: query.status }),
    ...(role === null ? {} : { role })
  };
}

/** Sets or clears the status filter and returns to the first page. */
export function usersQueryWithStatus(query: AdminUsersQuery, status: AdminUserStatus | null): AdminUsersQuery {
  return {
    page: 1,
    pageSize: query.pageSize,
    ...(query.search === undefined ? {} : { search: query.search }),
    ...(query.role === undefined ? {} : { role: query.role }),
    ...(status === null ? {} : { status })
  };
}

/** Moves to another users page, preserving the search and filters. */
export function usersQueryWithPage(query: AdminUsersQuery, page: number): AdminUsersQuery {
  return { ...query, page };
}

/** The role filter options, in template order, with the Spanish labels. */
export const ROLE_FILTERS: readonly { readonly value: AdminUserRole; readonly label: string }[] = Object.freeze([
  { value: "PYME", label: ROLE_LABEL.PYME },
  { value: "INVERSOR", label: ROLE_LABEL.INVERSOR },
  { value: "ADMIN", label: ROLE_LABEL.ADMIN }
]);

/** The status filter options, with the same copy as the status column. */
export const STATUS_FILTERS: readonly { readonly value: AdminUserStatus; readonly label: string }[] = Object.freeze([
  { value: "active", label: USER_STATUS_COPY.active.label },
  { value: "inactive", label: USER_STATUS_COPY.inactive.label },
  { value: "invited", label: USER_STATUS_COPY.invited.label }
]);

/** Applies an audit search term and returns to the first page. */
export function auditQueryWithSearch(query: AuditLogQuery, term: string): AuditLogQuery {
  const search = searchOrUndefined(term);
  return {
    page: 1,
    pageSize: query.pageSize,
    ...(search === undefined ? {} : { search })
  };
}

/** Moves to another audit page, preserving the search. */
export function auditQueryWithPage(query: AuditLogQuery, page: number): AuditLogQuery {
  return { ...query, page };
}

/**
 * Sanitized read failure codes: the API's own `unavailable` envelope plus the
 * transport's `network`. The UI maps each to its own copy.
 */
export type AdminUsersReadErrorCode = "unavailable" | "network";

/** The mutation codes the API can return, plus the two transport codes. */
export type AdminUsersMutationErrorCode =
  | AdminUsersReadErrorCode
  | "not_found"
  | "self"
  | "last_admin"
  | "already_inactive"
  | "target_is_admin"
  | "unchanged"
  | "role_not_allowed"
  | "email_exists";

export type AdminUsersPageResult =
  | { readonly ok: true; readonly page: AdminUsersPage }
  | { readonly ok: false; readonly code: AdminUsersReadErrorCode };

export type AuditLogResult =
  | { readonly ok: true; readonly page: AuditLogPage }
  | { readonly ok: false; readonly code: AdminUsersReadErrorCode };

export type AdminUsersMutationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: AdminUsersMutationErrorCode };

export type InviteOperatorOutcome =
  | { readonly ok: true; readonly invitation: InviteOperatorResult }
  | { readonly ok: false; readonly code: AdminUsersMutationErrorCode };

/** One Spanish message per sanitized mutation code; the code never reaches the DOM. */
export const MUTATION_ERROR_COPY: Readonly<Record<AdminUsersMutationErrorCode, string>> = Object.freeze({
  unavailable: "No pudimos completar la acción. No se modificó ningún dato.",
  network: "No pudimos contactar al servidor. No se modificó ningún dato.",
  not_found: "No encontramos ese usuario.",
  self: "No podés desactivar tu propia cuenta.",
  last_admin: "No podés desactivar al último administrador activo.",
  already_inactive: "La cuenta ya estaba inactiva.",
  target_is_admin: "No se puede cambiar el rol de un administrador.",
  unchanged: "El rol ya es ese.",
  role_not_allowed: "Ese cambio de rol no está permitido.",
  email_exists: "Ya existe una cuenta con ese correo."
});

/** The read failure copy, shared by the users list and the audit log. */
export const READ_ERROR_COPY: Readonly<Record<AdminUsersReadErrorCode, string>> = Object.freeze({
  unavailable: "No pudimos cargar los datos.",
  network: "No pudimos contactar al servidor."
});

/**
 * The admin › Usuarios capability (Feature #390). Vendor-free and React-free;
 * the HTTP adapter lives in `infrastructure/admin/`.
 *
 * Reads are server-side paginated; every write is an explicit command, so the
 * UI never sends a free-form recipient or role the server would have to trust.
 */
export interface AdminUsersPort {
  listUsers(query: AdminUsersQuery): Promise<AdminUsersPageResult>;
  listAudit(query: AuditLogQuery): Promise<AuditLogResult>;
  setUserActive(userId: string, command: SetUserActiveCommand): Promise<AdminUsersMutationResult>;
  changeUserRole(userId: string, command: ChangeUserRoleCommand): Promise<AdminUsersMutationResult>;
  /** Toggle the per-user assistant access flag (#499, D9). */
  setChatAccess(userId: string, command: SetChatAccessCommand): Promise<AdminUsersMutationResult>;
  inviteOperator(command: InviteOperatorCommand): Promise<InviteOperatorOutcome>;
}
