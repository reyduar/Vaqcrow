/**
 * User-facing copy for the PyME «Mi campaña» dashboard (Feature #434, WU2).
 * Kept in the React-free application layer so the container and the sections
 * share one source. Strings are verbatim from the PyME mode of
 * `Vaqcrow Portafolio.dc.html` unless marked owner-pending.
 */
export const MY_CAMPAIGNS_COPY = Object.freeze({
  listTitle: "Bóveda y distribuciones",
  /** Owner-pending: the template shows no empty-state copy for a PyME with no campaign. */
  emptyTitle: "Todavía no tenés una campaña",
  emptyBody:
    "Cuando tu PyME esté registrada y aprobada, acá vas a ver el estado de tu bóveda y las distribuciones que tengas que firmar.",
  vaultCustodyNote: "Destino de liquidación fijado por el contrato; es inmutable.",
  /** Owner-pending: the WU3 declare-sales entry is not designed by the template yet. */
  declareSales: "Declarar ventas",
  /** Owner-pending: the WU4 signing entry on a submitted distribution. */
  reviewAndSign: "Revisar y firmar",
  /** Owner-pending: honest reason while the WU3/WU4 actions are not wired. */
  unavailable: "Disponible próximamente",
  distributionsTitle: "Distribuciones",
  footnote: "Cálculo determinístico; la IA no calcula esta obligación",
  sortRecent: "Recientes",
  sortByState: "Por estado",
  loadingLabel: "Cargando tu campaña",
  errorTitle: "No pudimos cargar tu campaña",
  errorMessage: "El servicio no respondió. Ningún dato se modificó.",
  retryLabel: "Reintentar",
  /** Owner-pending: the template shows no empty-distributions copy for the PyME. */
  noDistributions: "Todavía no hay distribuciones para tu campaña."
});
