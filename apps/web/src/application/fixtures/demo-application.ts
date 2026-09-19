/**
 * ASSUMPTION: `apps/api` exposes no endpoint to create or list applications
 * yet, so the demo reviews one fixed, synthetic application. The id is a
 * placeholder UUIDv4 (the contract shape), not real data; the backend decides
 * whether that application exists and is awaiting human review.
 */
export const DEMO_APPLICATION_ID = "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f";

/** ASSUMPTION: no operator authentication exists in the demo; the actor is a simulated, editable label. */
export const DEMO_ACTOR = "operador-demo (simulado)";
