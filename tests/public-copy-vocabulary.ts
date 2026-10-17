/**
 * The public-copy denylist, in one place (#582).
 *
 * The list used to live only inside
 * `apps/web/src/application/about/public-copy-prohibited-terms.test.ts`, so the
 * assistant's wiki corpus (`docs/wiki/`) was never scanned against it. The
 * vocabulary cannot move into a package and the web test cannot be imported by
 * `apps/api` — `.dependency-cruiser.cjs` forbids cross-app imports
 * (`no-cross-app-imports`). Root `tests/` sits outside the cruise globs over
 * the `apps` and `packages` sources, and is where the repo already keeps
 * cross-app scans, so the single definition lives here: the web test imports
 * it, and the corpus scan (`tests/wiki-public-copy.test.ts`) imports it.
 * Nothing ships to either app; both consumers are tests.
 *
 * The patterns are deliberately blunt: no inflection and substring matches,
 * because a claim hides inside a longer word (`garantizado`, `solvente`). A
 * legitimate denial is declared and scrubbed by the consumer, never removed by
 * loosening a pattern.
 */

/** The eleven terms the public copy must never use. */
export const PUBLIC_COPY_TERMS: readonly RegExp[] = [
  /auditad/i,
  /producción/i,
  /listo para/i,
  /legalidad/i,
  /solvencia/i,
  /garantiz/i,
  /garantía/i,
  /rentabilidad/i,
  /asegur/i,
  /retorno/i,
  /proveedor(es)? de calidad/i
];

/**
 * The "never promises a return" half. Kept separate because it is a distinct
 * rule in the web test (`rendimiento` is legitimately absent from it), but the
 * corpus is checked against it too.
 */
export const RETURN_PROMISE_TERMS: readonly RegExp[] = [/promete/i, /promesa/i, /ganancia/i];

/** Everything a public surface and the assistant corpus are checked against. */
export const PUBLIC_COPY_DENYLIST: readonly RegExp[] = [
  ...PUBLIC_COPY_TERMS,
  ...RETURN_PROMISE_TERMS
];
