import { probeA } from "./circular-a.fixture";

export const probeB = "b";
export const usesA = (): string => probeA;
