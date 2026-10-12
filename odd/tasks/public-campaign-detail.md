# Bitácora — Detalle de campaña público y compartible

## Objetivo

Feature [#485](https://github.com/reyduar/Vaqcrow/issues/485): hacer **público y compartible por link** el detalle **real** de una campaña publicada, para que un inversor comparta la campaña con otro inversor que no está logueado.

## Por qué

El owner pidió (2026-10-12) que el detalle real sea público para compartir por link. Contradecía una decisión asentada («Detalle requires an account»), la compuerta que dibuja la plantilla y la política `AUTHENTICATED` de la ruta, así que se separó en esta Feature (de #481, que solo hizo público el *ejemplo*).

## Rama

- **Rama:** `Vaqcrow#485_Feat_Publish_the_campaign_detail_publicly_as_a_shareable_link` (off `main`).

## Decisiones del owner

D1 el `actor` del admin → **neutralizar** («Administración Vaqcrow»); D2 el gate de la plantilla → **retirar** la lectura sin sesión; D3 campos a retener → **ninguno** más.

## Unidades de trabajo

- [x] **U1 — API pública + `actor` neutralizado.** `route-policy.ts` (`AUTHENTICATED` → `PUBLIC`); `get-campaign-detail.ts` con `PUBLIC_DECISION_ACTOR`; tests: `get-campaign-detail.test.ts` (nuevo caso de neutralización + expectativa actualizada), `authorization.test.ts` (matriz a `public` + probe sin token con un registro publicado → 200), `marketplace.route.test.ts` (lectura anónima 200 + `actor` neutralizado).
- [x] **U2 — Web sin compuerta.** `campaign-detail.tsx`: se retiran `CampaignDetailGate` y la prop `signedIn`; el detalle se fetchea siempre. El gateway ya adjuntaba el token solo cuando existe, así que un visitante sin sesión simplemente no manda `Authorization` → ruta pública. Tests: se reemplazó el `describe` de la compuerta por uno de lectura pública; `campaign-contribution.test.tsx` dejó de pasar `signedIn`.
- [x] **U3 — Alineación de docs.** `AGENTS.md`/`CLAUDE.md` (twins), `docs/design/demo-ui.md`, `docs/guides/freighter-and-testnet-walkthrough.md`, una nota de actualización en la evidencia de #422, y varios comentarios de módulo que decían «account-gated».

## Verificación

- API: 459 pass en los 4 archivos afectados. Web: 48 pass en `campaign-detail` + `typecheck` limpio.
- `pnpm run verify` → ver el PR.

## Notas

- La neutralización del `actor` ocurre **en el use case** (`get-campaign-detail.ts`), no en el repositorio ni en la base: el nombre persistido sigue en la base y no cruza el borde público. El panel admin (`/application-reviews/:id/context`) NO usa este use case, así que sigue viendo el nombre real — solo se neutraliza la superficie pública.
- El reset de Testnet del 2026-12-16 no afecta a esta Feature (no toca contratos); ver [[docs/planning/testnet-reset-runbook|el runbook]].
