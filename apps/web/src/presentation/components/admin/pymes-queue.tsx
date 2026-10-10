"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { IoSearchOutline } from "react-icons/io5";
import {
  DEFAULT_ADMIN_QUEUE_QUERY,
  formatQueueUpdatedAt,
  MISSING_BUSINESS_LABEL,
  QUEUE_KPI_FILTERS,
  QUEUE_STATE_COPY,
  queueActionFor,
  queueDisplayState,
  queueQueryToggleFilter,
  queueSearchOrUndefined,
  queueSortToggle,
  queueTotalPages,
  type QueueFilterState
} from "@/application/admin/queue";
import { EVIDENCE_COPY } from "@/application/admin/evidence";
import { adminEvidencePath, adminReviewPath } from "@/application/admin/review";
import type {
  AdminQueueCounts,
  AdminQueuePort,
  AdminQueueQuery,
  AdminQueueSortField
} from "@/application/ports/admin-queue-port";
import { createBrowserAdminQueuePort } from "@/infrastructure/admin/create-admin-queue-port";
import { useAdminQueue } from "@/state/use-admin-queue";
import { ADMIN_ICONS, ADMIN_TONE_TEXT, AdminStatePill } from "./admin-state-pill";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

/** Shown while the first page is in flight or failed; never a fabricated total. */
const EMPTY_COUNTS: AdminQueueCounts = { pending: 0, changes: 0, approved: 0, rejected: 0 };

function nameOrMissing(name: string): string {
  return name.trim() === "" ? MISSING_BUSINESS_LABEL : name;
}

function sectorOrMissing(sector: string): string {
  return sector.trim() === "" ? MISSING_BUSINESS_LABEL : sector;
}

export interface PymesQueueProps {
  /** Injected in tests; production builds the browser port once. */
  readonly port?: AdminQueuePort;
}

/**
 * `/admin/pymes`: the PyMEs queue of `Vaqcrow Admin.dc.html` (view `pymes`).
 *
 * The KPI cards show the API's global `counts` and select the server-side
 * `state` filter (`aria-pressed`; clicking again clears), the search narrows
 * server-side through `q`, and paging and sorting are server-side
 * (`page`/`pageSize`/`sort`/`order`). Loading, empty and error states are
 * honest; a missing business renders the API's "Sin dato", never an invented
 * company or a zero.
 */
export function PymesQueue({ port }: PymesQueueProps) {
  const [resolvedPort] = useState<AdminQueuePort>(() => port ?? createBrowserAdminQueuePort());
  const [query, setQuery] = useState<AdminQueueQuery>(DEFAULT_ADMIN_QUEUE_QUERY);
  const [searchInput, setSearchInput] = useState("");
  const { page, isLoading, loadFailed, reload } = useAdminQueue(resolvedPort, query);

  const items = page?.items ?? [];
  const counts = page?.counts ?? EMPTY_COUNTS;
  const totalPages = page ? queueTotalPages(page.total, page.pageSize) : 1;
  const hasFilterOrSearch = query.state !== undefined || query.search !== undefined;

  function toggleFilter(state: QueueFilterState) {
    setQuery((current) => queueQueryToggleFilter(current, state));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search = queueSearchOrUndefined(searchInput);
    setQuery((current) => ({
      page: 1,
      pageSize: current.pageSize,
      sort: current.sort,
      order: current.order,
      ...(search === undefined ? {} : { search })
    }));
  }

  function changeSort(field: AdminQueueSortField) {
    setQuery((current) => ({ ...current, ...queueSortToggle(current, field), page: 1 }));
  }

  function goToPage(next: number) {
    setQuery((current) => ({ ...current, page: next }));
  }

  function ariaSortFor(field: AdminQueueSortField): "ascending" | "descending" | "none" {
    if (query.sort !== field) return "none";
    return query.order === "asc" ? "ascending" : "descending";
  }

  const emptyMessage = hasFilterOrSearch
    ? "No hay PyMEs que coincidan con la búsqueda o el filtro."
    : "No hay solicitudes.";

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[clamp(30px,4vw,40px)] leading-[1.1] font-bold tracking-[-0.03em]">PyMEs</h1>
        <p className="m-0 text-text-secondary">Solicitudes y campañas registradas. Toda decisión queda atribuida.</p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {QUEUE_KPI_FILTERS.map((filter) => {
          const pressed = query.state === filter.state;
          const Icon = ADMIN_ICONS[filter.icon];
          return (
            <button
              key={filter.state}
              type="button"
              aria-pressed={pressed}
              onClick={() => toggleFilter(filter.state)}
              className={`cursor-pointer rounded-panel bg-raised p-5 text-left text-text-primary ${FOCUS_RING} ${
                pressed ? "border-2 border-brand-accent-text" : "border border-page-border"
              }`}
            >
              <span className={`flex items-center gap-1.5 text-[13px] font-semibold ${ADMIN_TONE_TEXT[filter.tone]}`}>
                <Icon aria-hidden="true" focusable="false" className="text-base" />
                {filter.label}
              </span>
              <span className="mt-1 block text-[32px] font-bold">{counts[filter.state]}</span>
            </button>
          );
        })}
      </div>

      <form
        role="search"
        onSubmit={submitSearch}
        className="flex h-12 max-w-[480px] items-center gap-2.5 rounded-control border border-control px-3.5"
      >
        <IoSearchOutline aria-hidden="true" focusable="false" className="shrink-0 text-[19px] text-text-secondary" />
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Buscar por nombre, rubro o ID"
          aria-label="Buscar PyMEs"
          className="flex-1 border-0 bg-transparent text-text-primary outline-none"
        />
      </form>

      {loadFailed ? (
        <div role="alert" className="flex flex-col gap-3 rounded-panel border border-page-border bg-raised p-5 text-text-primary">
          <p className="m-0 text-sm">No pudimos cargar las solicitudes. No se modificó ningún dato.</p>
          <button
            type="button"
            onClick={reload}
            className={`h-11 w-fit rounded-control border border-control px-4 text-sm font-semibold text-text-primary hover:bg-page-surface ${FOCUS_RING}`}
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-panel border border-page-border">
          <table className="w-full min-w-[760px] border-collapse text-sm" aria-busy={isLoading ? "true" : undefined}>
            <thead>
              <tr className="bg-page-surface">
                <th scope="col" aria-sort={ariaSortFor("name")} className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                  <button type="button" onClick={() => changeSort("name")} className={`rounded ${FOCUS_RING}`}>
                    PyME
                  </button>
                </th>
                <th scope="col" aria-sort={ariaSortFor("sector")} className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                  <button type="button" onClick={() => changeSort("sector")} className={`rounded ${FOCUS_RING}`}>
                    Rubro
                  </button>
                </th>
                <th scope="col" aria-sort={ariaSortFor("state")} className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                  <button type="button" onClick={() => changeSort("state")} className={`rounded ${FOCUS_RING}`}>
                    Estado
                  </button>
                </th>
                <th scope="col" aria-sort={ariaSortFor("updatedAt")} className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                  <button type="button" onClick={() => changeSort("updatedAt")} className={`rounded ${FOCUS_RING}`}>
                    Último cambio
                  </button>
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-text-secondary" role="status">
                    Cargando…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-text-secondary">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const displayState = queueDisplayState(item.state);
                  const action = queueActionFor(displayState);
                  return (
                    <tr key={item.applicationId} className="border-t border-page-border">
                      <th scope="row" className="px-4 py-3.5 text-left font-[650]">
                        <div>{nameOrMissing(item.name)}</div>
                        <div className="font-mono text-xs font-normal text-text-secondary">{item.applicationId}</div>
                      </th>
                      <td className="px-4 py-3.5">{sectorOrMissing(item.sector)}</td>
                      <td className="px-4 py-3.5">
                        <AdminStatePill copy={QUEUE_STATE_COPY[displayState]} />
                      </td>
                      <td className="px-4 py-3.5 text-text-secondary">{formatQueueUpdatedAt(item.updatedAt)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={adminEvidencePath(item.applicationId)}
                            aria-label={`${EVIDENCE_COPY.linkLabel} de ${nameOrMissing(item.name)}`}
                            className={`inline-flex h-[38px] items-center rounded-control px-3.5 text-[13px] font-semibold whitespace-nowrap text-text-primary no-underline hover:bg-page-surface ${FOCUS_RING}`}
                          >
                            {EVIDENCE_COPY.linkLabel}
                          </Link>
                          <Link
                            href={adminReviewPath(item.applicationId)}
                            className={`inline-flex h-[38px] items-center rounded-control px-3.5 text-[13px] font-semibold whitespace-nowrap no-underline ${FOCUS_RING} ${
                              action.primary
                                ? "bg-brand-accent text-on-accent hover:bg-brand-accent-hover"
                                : "border border-control bg-transparent text-text-primary hover:bg-page-surface"
                            }`}
                          >
                            {action.label}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loadFailed && totalPages > 1 ? (
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => goToPage(query.page - 1)}
            disabled={query.page <= 1}
            className={`h-11 rounded-control border border-control px-4 text-sm font-semibold text-text-primary hover:bg-page-surface disabled:opacity-50 ${FOCUS_RING}`}
          >
            Anterior
          </button>
          <span className="text-sm text-text-secondary">
            Página {query.page} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => goToPage(query.page + 1)}
            disabled={query.page >= totalPages}
            className={`h-11 rounded-control border border-control px-4 text-sm font-semibold text-text-primary hover:bg-page-surface disabled:opacity-50 ${FOCUS_RING}`}
          >
            Siguiente
          </button>
        </div>
      ) : null}
    </>
  );
}
