import { createStore, type StoreApi } from "zustand/vanilla";

/**
 * Cross-route client workflow identifiers of the single demo journey.
 *
 * Boundary: this store holds identifiers ONLY. No amounts, states, decisions
 * or any other server data — SWR owns server state and the backend owns
 * authoritative state. A per-request store is created through
 * `JourneyStoreProvider`; there is no global module store.
 */
export interface JourneyIds {
  applicationId: string | null;
  campaignId: string | null;
  distributionId: string | null;
}

export interface JourneyActions {
  /** A different application invalidates the campaign and distribution ids. */
  recordApplication: (id: string) => void;
  /** A different campaign invalidates the distribution id. */
  recordCampaign: (id: string) => void;
  recordDistribution: (id: string) => void;
  /**
   * The URL won: replaces the ids wholesale (unsupplied ones become null) after
   * the same normalization and hierarchy rules as the initial state. A no-op
   * when nothing changes, so subscribers are not notified needlessly.
   */
  hydrate: (ids: Partial<JourneyIds>) => void;
  reset: () => void;
}

export type JourneyState = JourneyIds & JourneyActions;
export type JourneyStore = StoreApi<JourneyState>;

const EMPTY: JourneyIds = { applicationId: null, campaignId: null, distributionId: null };

function normalizeId(id: string): string {
  const trimmed = id.trim();
  if (trimmed === "") throw new Error("Journey identifiers must be non-empty strings.");
  return trimmed;
}

function normalizeOptionalId(id: string | null | undefined): string | null {
  return id === null || id === undefined ? null : normalizeId(id);
}

/**
 * The hierarchy is the store's invariant: a campaign needs an application and a
 * distribution needs a campaign, whether they arrive as initial state or as a
 * later write. A violation throws instead of silently storing an orphan.
 */
function normalizeInitial(initial: Partial<JourneyIds>): JourneyIds {
  const applicationId = normalizeOptionalId(initial.applicationId);
  const campaignId = normalizeOptionalId(initial.campaignId);
  const distributionId = normalizeOptionalId(initial.distributionId);
  if (campaignId !== null && applicationId === null) {
    throw new Error("A campaign identifier requires an application identifier.");
  }
  if (distributionId !== null && campaignId === null) {
    throw new Error("A distribution identifier requires a campaign identifier.");
  }
  return { applicationId, campaignId, distributionId };
}

export function createJourneyStore(initial: Partial<JourneyIds> = {}): JourneyStore {
  return createStore<JourneyState>()((set, get) => ({
    ...normalizeInitial(initial),
    recordApplication: (id) => {
      const next = normalizeId(id);
      if (next === get().applicationId) return;
      set({ applicationId: next, campaignId: null, distributionId: null });
    },
    recordCampaign: (id) => {
      const next = normalizeId(id);
      if (get().applicationId === null) {
        throw new Error("A campaign identifier requires an application identifier.");
      }
      if (next === get().campaignId) return;
      set({ campaignId: next, distributionId: null });
    },
    recordDistribution: (id) => {
      const next = normalizeId(id);
      if (get().campaignId === null) {
        throw new Error("A distribution identifier requires a campaign identifier.");
      }
      set({ distributionId: next });
    },
    hydrate: (ids) => {
      const next = normalizeInitial(ids);
      const current = get();
      if (
        next.applicationId === current.applicationId &&
        next.campaignId === current.campaignId &&
        next.distributionId === current.distributionId
      ) {
        return;
      }
      set(next);
    },
    reset: () => set({ ...EMPTY })
  }));
}
