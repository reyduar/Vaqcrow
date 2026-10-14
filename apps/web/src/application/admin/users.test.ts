import { describe, expect, it } from "vitest";
import {
  activateConfirmCopy,
  ADMIN_AUDIT_PAGE_SIZE,
  ADMIN_USERS_PAGE_SIZE,
  auditQueryWithPage,
  auditQueryWithSearch,
  chatAccessConfirmCopy,
  chatAccessControlLabel,
  DEFAULT_ADMIN_AUDIT_QUERY,
  DEFAULT_ADMIN_USERS_QUERY,
  deactivateConfirmCopy,
  formatAuditTimestamp,
  formatLastActivityAt,
  KYC_COPY,
  MUTATION_ERROR_COPY,
  NEVER_ACTIVE_LABEL,
  READ_ERROR_COPY,
  roleChangeConfirmCopy,
  roleChangeLabel,
  roleChangeTarget,
  ROLE_LABEL,
  SELF_ACCOUNT_LABEL,
  totalPages,
  USER_STATUS_COPY,
  userActivationControl,
  usersQueryWithPage,
  usersQueryWithRole,
  usersQueryWithSearch,
  usersQueryWithStatus
} from "./users";

describe("role labels and targets", () => {
  it("keeps the wire role values in English and labels them in Spanish", () => {
    expect(ROLE_LABEL).toEqual({ PYME: "PyME", INVERSOR: "Inversor", ADMIN: "Administrador" });
  });

  it("offers only the other non-admin role as a change target", () => {
    expect(roleChangeTarget("PYME")).toBe("INVERSOR");
    expect(roleChangeTarget("INVERSOR")).toBe("PYME");
    expect(roleChangeTarget("ADMIN")).toBeUndefined();
  });

  it("names the role-change control after its target", () => {
    expect(roleChangeLabel("INVERSOR")).toBe("Cambiar a Inversor");
    expect(roleChangeLabel("PYME")).toBe("Cambiar a PyME");
  });
});

describe("status and KYC copy", () => {
  it("uses the template's Activo/Inactivo plus the contract's invited state", () => {
    expect(USER_STATUS_COPY.active.label).toBe("Activo");
    expect(USER_STATUS_COPY.inactive.label).toBe("Inactivo");
    expect(USER_STATUS_COPY.invited.label).toBe("Invitado");
  });

  it("labels the simulated KYC honestly and read-only", () => {
    expect(KYC_COPY.approved_simulated).toEqual({ label: "KYC aprobado (simulado)", variant: "simulado" });
    expect(KYC_COPY.not_started.label).toBe("KYC sin iniciar");
    expect(KYC_COPY.not_applicable.label).toBe("KYC no aplica");
  });
});

describe("userActivationControl", () => {
  it("shows 'Tu cuenta' and no toggle on the signed-in admin's own row", () => {
    expect(userActivationControl({ isSelf: true, status: "active" })).toEqual({
      kind: "self",
      label: SELF_ACCOUNT_LABEL
    });
  });

  it("offers Desactivar for an active account and Activar for an inactive one", () => {
    expect(userActivationControl({ isSelf: false, status: "active" })).toEqual({
      kind: "toggle",
      label: "Desactivar",
      nextActive: false
    });
    expect(userActivationControl({ isSelf: false, status: "inactive" })).toEqual({
      kind: "toggle",
      label: "Activar",
      nextActive: true
    });
  });

  it("invents no row action for a pending invitation", () => {
    expect(userActivationControl({ isSelf: false, status: "invited" })).toEqual({ kind: "none" });
  });
});

describe("confirm copy", () => {
  it("repeats the template's deactivation copy verbatim", () => {
    expect(deactivateConfirmCopy("Lucía Fernández")).toEqual({
      title: "Desactivar a Lucía Fernández",
      body: "Pierde el acceso. Sus aportes y campañas no se modifican."
    });
  });

  it("repeats the template's activation copy verbatim", () => {
    expect(activateConfirmCopy("Lucía Fernández")).toEqual({
      title: "Activar a Lucía Fernández",
      body: "Vuelve a tener acceso a la demo."
    });
  });

  it("states the target role and the audit consequence on a role change", () => {
    expect(roleChangeConfirmCopy("F. Díaz", "INVERSOR")).toEqual({
      title: "Cambiar rol de F. Díaz",
      body: "Su cuenta pasa a Inversor. El cambio queda auditado."
    });
  });
});

describe("formatLastActivityAt", () => {
  it("formats an ISO timestamp as dd/mm/aaaa", () => {
    expect(formatLastActivityAt("2026-09-11T12:00:00.000Z")).toBe("11/09/2026");
  });

  it("reads a null timestamp as 'Sin actividad' and an unreadable one as 'Sin dato'", () => {
    expect(formatLastActivityAt(null)).toBe(NEVER_ACTIVE_LABEL);
    expect(formatLastActivityAt("not-a-date")).toBe("Sin dato");
  });
});

describe("formatAuditTimestamp", () => {
  it("formats as dd/mm HH:MM", () => {
    expect(formatAuditTimestamp("2026-09-13T09:15:00.000Z")).toMatch(/^13\/09 \d{2}:\d{2}$/);
  });

  it("degrades to 'Sin dato' instead of an invalid date", () => {
    expect(formatAuditTimestamp("not-a-date")).toBe("Sin dato");
  });
});

describe("pagination and query helpers", () => {
  it("defaults to the first page of each list", () => {
    expect(DEFAULT_ADMIN_USERS_QUERY).toEqual({ page: 1, pageSize: ADMIN_USERS_PAGE_SIZE });
    expect(DEFAULT_ADMIN_AUDIT_QUERY).toEqual({ page: 1, pageSize: ADMIN_AUDIT_PAGE_SIZE });
  });

  it("never reports zero pages", () => {
    expect(totalPages(0, 20)).toBe(1);
    expect(totalPages(20, 20)).toBe(1);
    expect(totalPages(21, 20)).toBe(2);
  });

  it("sets the search and returns to the first page, preserving the filters", () => {
    expect(usersQueryWithSearch({ page: 3, pageSize: 20, role: "PYME" }, " lucía ")).toEqual({
      page: 1,
      pageSize: 20,
      role: "PYME",
      search: "lucía"
    });
  });

  it("clears the search when the box is emptied", () => {
    expect(usersQueryWithSearch({ page: 2, pageSize: 20, search: "x" }, "   ")).toEqual({ page: 1, pageSize: 20 });
  });

  it("sets and clears the role and status filters", () => {
    expect(usersQueryWithRole({ page: 2, pageSize: 20, status: "active" }, "INVERSOR")).toEqual({
      page: 1,
      pageSize: 20,
      status: "active",
      role: "INVERSOR"
    });
    expect(usersQueryWithRole({ page: 2, pageSize: 20, role: "PYME" }, null)).toEqual({ page: 1, pageSize: 20 });
    expect(usersQueryWithStatus({ page: 2, pageSize: 20 }, "inactive")).toEqual({
      page: 1,
      pageSize: 20,
      status: "inactive"
    });
  });

  it("moves pages while preserving the search and filters", () => {
    expect(usersQueryWithPage({ page: 1, pageSize: 20, search: "x" }, 2)).toEqual({
      page: 2,
      pageSize: 20,
      search: "x"
    });
    expect(auditQueryWithPage({ page: 1, pageSize: 10, search: "x" }, 3)).toEqual({
      page: 3,
      pageSize: 10,
      search: "x"
    });
  });

  it("sets and clears the audit search", () => {
    expect(auditQueryWithSearch({ page: 4, pageSize: 10 }, "rol")).toEqual({ page: 1, pageSize: 10, search: "rol" });
    expect(auditQueryWithSearch({ page: 4, pageSize: 10, search: "rol" }, " ")).toEqual({ page: 1, pageSize: 10 });
  });
});

describe("error copy", () => {
  it("has a Spanish message for every read and mutation code", () => {
    expect(READ_ERROR_COPY.unavailable).toBe("No pudimos cargar los datos.");
    expect(READ_ERROR_COPY.network).toBe("No pudimos contactar al servidor.");
    expect(MUTATION_ERROR_COPY.self).toBe("No podés desactivar tu propia cuenta.");
    expect(MUTATION_ERROR_COPY.last_admin).toBe("No podés desactivar al último administrador activo.");
    expect(MUTATION_ERROR_COPY.target_is_admin).toBe("No se puede cambiar el rol de un administrador.");
    expect(MUTATION_ERROR_COPY.email_exists).toBe("Ya existe una cuenta con ese correo.");
  });
});

describe("assistant access control (#499, D9)", () => {
  it("labels the toggle from the real flag", () => {
    expect(chatAccessControlLabel(true)).toBe("Deshabilitar asistente");
    expect(chatAccessControlLabel(false)).toBe("Habilitar asistente");
  });

  it("states the outcome in the confirmation, both ways", () => {
    expect(chatAccessConfirmCopy("Lucía", true)).toEqual({
      title: "Habilitar el asistente de Lucía",
      body: "Va a poder preguntarle al asistente desde la landing y el centro de ayuda."
    });
    expect(chatAccessConfirmCopy("Lucía", false)).toEqual({
      title: "Deshabilitar el asistente de Lucía",
      body: "Deja de ver el asistente. El resto de su cuenta no cambia."
    });
  });
});
