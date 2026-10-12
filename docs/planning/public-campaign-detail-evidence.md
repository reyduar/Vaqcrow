---
title: Public campaign detail
tags:
  - planning
  - evidence
  - campaign-detail
  - security
date: 2026-10-12
status: delivered
---

# Feature #485 — Detalle de campaña público y compartible

> [!info] Objetivo
> Que cualquier visitante —con o sin sesión— pueda abrir un link compartido al detalle de una campaña **publicada** y leerlo, para que un inversor comparta la campaña con otro inversor que no está logueado. Antes, la ruta era `AUTHENTICATED` y la web mostraba la compuerta del template.

## Decisiones del owner (2026-10-12)

| # | Pregunta | Resolución |
|---|---|---|
| D1 | El `actor` de la decisión humana (el nombre del admin) | **Neutralizar** a una etiqueta de rol: «Administración Vaqcrow» |
| D2 | El gate de la plantilla («Ingresá para ver esta campaña») | **Retirarlo**: el detalle se lee sin sesión |
| D3 | Campos a retener de más | **Ninguno**: el resto (fondeo, revenue share, riesgo, KYC, evaluación de IA, evidencia de ventas) es información pública de una campaña publicada |

## Cambios

**API**
- `apps/api/src/application/authorization/route-policy.ts`: `GET /marketplace/campaigns/:campaignId` pasó de `AUTHENTICATED` a `PUBLIC` (con el comentario actualizado).
- `apps/api/src/application/use-cases/get-campaign-detail.ts`: nueva constante exportada `PUBLIC_DECISION_ACTOR = "Administración Vaqcrow"`; el `decision.actor` del payload es esa etiqueta, nunca el nombre persistido del operador.

**Web**
- `apps/web/src/presentation/components/campaign-detail/campaign-detail.tsx`: se retiró la compuerta (`CampaignDetailGate`) y la prop `signedIn`; el detalle se fetchea siempre (`useCampaignDetail(..., true)`). Solo queda la prop `role`, que gobierna el CTA de aporte.
- El gateway ya adjuntaba el token sólo cuando existe: sin sesión, la request sale sin `Authorization` y la ruta pública responde. No hizo falta tocar el gateway.

**Contratos y docs** (alineación obligatoria)
- `packages/contracts/src/campaign-detail.ts` (+ su test) y varios comentarios de módulo dejaron de decir «account-gated».
- `AGENTS.md`/`CLAUDE.md` (twins byte-idénticos): la decisión asentada «Detalle requires an account» se actualizó.
- `docs/design/demo-ui.md` (§4, fila de Detalle de PyME) y `docs/guides/freighter-and-testnet-walkthrough.md` (§3) reflejan el detalle público.
- `docs/planning/campaign-detail-and-contributions-evidence.md` (#422) lleva una nota de actualización apuntando a esta Feature, sin reescribir su registro histórico.

## Criterios de aceptación (verbatim del issue) → verificación

- **«A signed-out visitor reads a published campaign detail from a shared link.»** → `campaign-detail.test.tsx › CampaignDetail (public read) › fetches and renders the detail without a session` (render sin sesión: las llamadas y el render ocurren; no hay compuerta). Y, en la API, `authorization.test.ts` fija la ruta como `public` y el probe sin token responde `200`.
- **«The public payload exposes no admin display name unless the owner decides otherwise.»** → el owner decidió **neutralizar** (D1). Verificado en `get-campaign-detail.test.ts › neutralizes the human-decision actor…` (el payload dice «Administración Vaqcrow» y **no** contiene el nombre persistido) y en `marketplace.route.test.ts › … neutralizes the operator name`.
- **«An unknown or unpublished id still answers 404.»** → sin cambios en el use case; cubierto por `get-campaign-detail.test.ts › answers not_found…` y `marketplace.route.test.ts › answers 404 when the campaign is unknown or not published`.
- **«Contribution/withdraw remain unavailable to a signed-out visitor.»** → sin sesión no hay rol `INVERSOR`, y `CampaignDetailView` monta aporte/retiro solo para `role === "INVERSOR"`; cubierto por los tests de `campaign-contribution.test.tsx` (la compuerta del CTA).
- **«`pnpm run verify` passes, and `AGENTS.md`/`CLAUDE.md` + design docs reflect the change.»** → ver la sección siguiente.

## Verificación

- API: `pnpm --filter @vaqcrow/api exec vitest run src/application/use-cases/get-campaign-detail.test.ts src/application/authorization/route-policy.test.ts src/infrastructure/http/authorization.test.ts src/infrastructure/http/routes/marketplace.route.test.ts` → **459 pass**, 0 fallos.
- Web: `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/campaign-detail` → **48 pass**; `pnpm --filter @vaqcrow/web typecheck` limpio.
- `pnpm run verify` → ver el PR de la Feature; `AGENTS.md` y `CLAUDE.md` siguen byte-idénticos.

## Límites y notas

- El reset de Testnet del **2026-12-16** no afecta a esta Feature (no toca contratos), pero invalidará las direcciones de las campañas ya desplegadas; ver el [runbook del reset](./testnet-reset-runbook.md).
- La evidencia «de punta a punta» (un visitante anónimo real contra el despliegue hosteado) no se corrió: los tests son deterministas y sin red, y el despliegue del API ocurre al mergear. El smoke hosteado sigue pendiente y se anota como tal.
