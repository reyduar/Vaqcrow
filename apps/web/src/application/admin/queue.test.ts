import { describe, expect, it } from "vitest";
import type { AdminQueueItem } from "@/application/ports/admin-queue-port";
import {
  ADMIN_QUEUE_PAGE_SIZE,
  countQueueStates,
  DEFAULT_ADMIN_QUEUE_QUERY,
  filterQueueItems,
  formatQueueUpdatedAt,
  MISSING_BUSINESS_LABEL,
  QUEUE_KPI_FILTERS,
  QUEUE_STATE_COPY,
  queueActionFor,
  queueDisplayState,
  queueSortToggle,
  queueTotalPages
} from "./queue";

function item(overrides: Partial<AdminQueueItem> = {}): AdminQueueItem {
  return {
    applicationId: "VQ-0001",
    name: "Panadería Horizonte SRL",
    sector: "Alimentos",
    state: "awaiting_assessment",
    updatedAt: "2026-09-11T12:00:00.000Z",
    ...overrides
  };
}

describe("queueDisplayState", () => {
  it("groups every not-yet-decided state as pending", () => {
    expect(queueDisplayState("draft")).toBe("pending");
    expect(queueDisplayState("awaiting_assessment")).toBe("pending");
    expect(queueDisplayState("human_review")).toBe("pending");
  });

  it("maps the decided states one to one", () => {
    expect(queueDisplayState("changes_requested")).toBe("changes");
    expect(queueDisplayState("approved")).toBe("approved");
    expect(queueDisplayState("rejected")).toBe("rejected");
  });
});

describe("queue copy", () => {
  it("uses the template's state labels verbatim", () => {
    expect(QUEUE_STATE_COPY.pending.label).toBe("Pendiente de revisión");
    expect(QUEUE_STATE_COPY.changes.label).toBe("Requiere cambios");
    expect(QUEUE_STATE_COPY.approved.label).toBe("Aprobada");
    expect(QUEUE_STATE_COPY.rejected.label).toBe("Rechazada");
  });

  it("names the three KPI filters as the template does", () => {
    expect(QUEUE_KPI_FILTERS.map((filter) => filter.label)).toEqual([
      "Pendientes de revisión",
      "Requieren cambios",
      "Aprobadas"
    ]);
  });

  it("uses the honest 'Sin dato' label for a missing business", () => {
    expect(MISSING_BUSINESS_LABEL).toBe("Sin dato");
  });
});

describe("queueActionFor", () => {
  it("marks a pending row as the primary review action", () => {
    expect(queueActionFor("pending")).toEqual({ label: "Revisar solicitud", primary: true });
  });

  it("keeps every other row as a secondary detail action", () => {
    for (const state of ["changes", "approved", "rejected"] as const) {
      expect(queueActionFor(state)).toEqual({ label: "Ver detalle", primary: false });
    }
  });
});

describe("filterQueueItems and countQueueStates", () => {
  const items = [
    item({ applicationId: "VQ-0001", state: "awaiting_assessment" }),
    item({ applicationId: "VQ-0002", state: "changes_requested" }),
    item({ applicationId: "VQ-0003", state: "approved" }),
    item({ applicationId: "VQ-0004", state: "human_review" })
  ];

  it("returns every row when no filter is active", () => {
    expect(filterQueueItems(items, null)).toHaveLength(4);
  });

  it("keeps only the rows of the active KPI filter", () => {
    expect(filterQueueItems(items, "pending").map((row) => row.applicationId)).toEqual(["VQ-0001", "VQ-0004"]);
    expect(filterQueueItems(items, "changes").map((row) => row.applicationId)).toEqual(["VQ-0002"]);
    expect(filterQueueItems(items, "approved").map((row) => row.applicationId)).toEqual(["VQ-0003"]);
  });

  it("counts the loaded rows per KPI", () => {
    expect(countQueueStates(items)).toEqual({ pending: 2, changes: 1, approved: 1 });
  });
});

describe("formatQueueUpdatedAt", () => {
  it("formats an ISO timestamp as dd/mm/aaaa", () => {
    expect(formatQueueUpdatedAt("2026-09-11T12:00:00.000Z")).toBe("11/09/2026");
  });

  it("degrades to 'Sin dato' instead of an invalid date", () => {
    expect(formatQueueUpdatedAt("not-a-date")).toBe("Sin dato");
  });
});

describe("pagination and sorting", () => {
  it("defaults to the most recently changed first", () => {
    expect(DEFAULT_ADMIN_QUEUE_QUERY).toMatchObject({
      page: 1,
      pageSize: ADMIN_QUEUE_PAGE_SIZE,
      sort: "updatedAt",
      order: "desc"
    });
  });

  it("flips the order when the same column is toggled again", () => {
    expect(queueSortToggle({ sort: "updatedAt", order: "desc" }, "updatedAt")).toEqual({
      sort: "updatedAt",
      order: "asc"
    });
  });

  it("starts a new column ascending, except the date column descending", () => {
    expect(queueSortToggle({ sort: "updatedAt", order: "desc" }, "name")).toEqual({ sort: "name", order: "asc" });
    expect(queueSortToggle({ sort: "name", order: "asc" }, "updatedAt")).toEqual({
      sort: "updatedAt",
      order: "desc"
    });
  });

  it("never reports zero pages", () => {
    expect(queueTotalPages(0, 20)).toBe(1);
    expect(queueTotalPages(20, 20)).toBe(1);
    expect(queueTotalPages(21, 20)).toBe(2);
  });
});
