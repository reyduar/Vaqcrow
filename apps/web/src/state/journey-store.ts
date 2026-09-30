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

export function createJourneyStore(initial: Partial<JourneyIds> = {}): JourneyStore {
  return createStore<JourneyState>()((set, get) => ({
    ...EMPTY,
    ...initial,
    recordApplication: (id) => {
      const next = normalizeId(id);
      if (next === get().applicationId) return;
      set({ applicationId: next, campaignId: null, distributionId: null });
    },
    recordCampaign: (id) => {
      const next = normalizeId(id);
      if (next === get().campaignId) return;
      set({ campaignId: next, distributionId: null });
    },
    recordDistribution: (id) => set({ distributionId: normalizeId(id) }),
    reset: () => set({ ...EMPTY })
  }));
}
