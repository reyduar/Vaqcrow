---
title: Business use of funds
tags:
  - planning
  - evidence
  - onboarding
  - campaign-detail
  - database
date: 2026-10-16
status: delivered
---

# Feature #577 — Destino de los fondos en el registro y en el detalle de campaña

> [!info] Objetivo
> Que la PyME cuente en el paso 2 del registro para qué necesita los fondos, y que el detalle público de la campaña, el panel «Ver lo enviado» y la revisión del admin lo muestren. Bitácora: [[odd/tasks/business-use-of-funds|business-use-of-funds]].

## Hallazgo del owner (verbatim)

> en el registro de pyme en el paso 2, no encuentro el campo donde explico el Destino de los fondos que se muestra en la pagina de detalle de la campanha

## Causa

El template del detalle (`Vaqcrow Detalle PyME.dc.html`) dibuja «Destino de los fondos» con datos de ejemplo fijos, pero el del onboarding no tiene ningún campo para cargarlo. La implementación de #422 mostraba un «Sin dato» fijo para no inventar el dato.

## Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | Texto libre, obligatorio en el wizard (owner: «b» y «si») | Es lo más simple. El desglose por ítem con porcentajes del template se descartó |
| D2 | La columna `businesses.use_of_funds` es nullable, con un máximo de 2000 caracteres | Las filas existentes no tienen el dato y siguen mostrando «Sin dato» |
| D3 | La API **acepta** `useOfFunds` pero **no lo exige**; si llega vacío, guarda NULL | La web vieja no recibe un 400 durante el deploy. La exigencia está en la web |
| D4 | `campaignDetailSchema.useOfFunds` es `nullable().optional()` | Vercel despliega antes que Railway: la web nueva tiene que funcionar contra la API vieja |
| D5 | En `marketplace_campaign_detail`, `use_of_funds` va como **última** columna | Postgres solo permite agregar columnas al final de una vista |
| D6 | La migración va al remoto **antes** del merge | La API nueva escribe y lee la columna |
| D7 | El bloque del admin es un *slot* nuevo de `ReviewView` | Un test previo fija que el shell sin slots no dibuja secciones |

## Cambios

- **DB** (`6eb1017`): `supabase/migrations/20261016165845_add_business_use_of_funds.sql` y los pgTAP `businesses_ownership.sql` y `marketplace_campaign_detail.sql`.
- **API y contrato** (`8d50c70`):
  - `DRAFT_KEYS` y la validación en `use-cases/business.ts`.
  - El repositorio de `businesses` y el del detalle.
  - `campaignDetailSchema`.
  - `openapi.json` regenerado.
- **Web** (`6b4f7f7`):
  - Paso 2 del wizard, `business-persistence`, `http-business-gateway`.
  - `UsesSection` del detalle.
  - `submitted-data.ts`.
  - `UseOfFundsSection` en la revisión del admin.

## Criterios de aceptación (verbatim del issue #577) → verificación

- **«Step 2 shows a required «Destino de los fondos» field; empty blocks «Continuar»; «Completar con datos de ejemplo» fills it.»** → Tests de `registration-step`:
  - el error «Contanos para qué vas a usar los fondos: al menos 20 caracteres.» bloquea el avance, mueve el foco al campo y queda enlazado con `aria-describedby`;
  - `DEMO_VALUES.useOfFunds` llena el campo.
- **«The submitted text is persisted and shown on `/campaigns/[id]` under «Destino de los fondos».»**
  - API: `POST /businesses` guarda el texto con trim.
  - Vista: pgTAP comprueba el valor para A y NULL para B.
  - Detalle: el test de la vista dibuja el texto como texto plano; un `<b>` literal no se interpreta como HTML.
- **«A campaign without the value still shows «Sin dato».»** → Se conserva el texto exacto de antes, y la campaña de ejemplo queda igual.
- **««Ver lo enviado» and the admin review show the text.»** → Tests de `submitted-data` y de `UseOfFundsSection`: muestran el texto o «Sin dato».
- **«The migration is applied to the remote with its history aligned; `pnpm run verify` and `pnpm run test:db` pass.»**
  - Remoto: ver «Verificación».
  - `pnpm run verify` → exit 0.
  - pgTAP: `businesses_ownership` 53/53 y `marketplace_campaign_detail` 96/98. Fallan solo los dos conteos ambientales (ver «Límites»).

## Verificación

- **Implementación:** la hizo un writer acotado (T1–T3), porque la sesión había pasado el backstop de contexto.
  - Hubo corrida RED en cada grupo de tests nuevo, salvo `business-persistence.test.ts` y `http-business-gateway.test.ts`, que se escribieron junto con su implementación.
  - `pnpm run verify` → exit 0: contracts 762, API 3237, web 2545, `no dependency violations found (1419 modules, 4738 dependencies cruised)`.
- **Verificador independiente** (riesgo alto: migración y contrato). Revisó el candidato `6b4f7f7` en una copia aparte.
  - S2–S5 PASS, sin bloqueantes.
  - El `diff -w` de la vista contra `20261008230000` muestra solo `b.use_of_funds` y la columna final.
  - API: 11/11 probes. Sin el campo, la respuesta es igual a la de la base, que es el invariante del deploy.
  - Contrato: 21/21 probes.
- **Remoto** (MCP de Supabase, 2026-10-16, con autorización del owner, **antes** del merge):
  - Estado previo: la columna no existía, la vista tenía 30 columnas terminadas en `sales_months` y la última versión era `20261016143937`.
  - La migración se aplicó con el cuerpo del archivo (`sha256` del cuerpo `3c2542bf1d062784…`) y la versión se alineó a `20261016165845`.
  - Verificado: `use_of_funds` es `text` nullable y existe `businesses_use_of_funds_length_check`; la vista termina en `…, sales_months, use_of_funds` con `security_invoker = true`; solo `service_role` puede leerla; `businesses` sigue con RLS y sin privilegios para `authenticated`.
  - La API desplegada en ese momento, todavía la vieja, respondió `200` en `GET /marketplace/campaigns` y en el detalle.
- **Seguridad** (OWASP Top 10:2025; el LLM Top 10 2026 no aplica porque el texto nunca entra en un prompt): **sin hallazgos**.
  - A01: no hay grants nuevos.
  - A03/A05: el texto del usuario se muestra como nodo de texto, sin `dangerouslySetInnerHTML`.
  - A04: el largo está acotado en la DB, la API y la web.

## Límites y notas

- **Conteos ambientales:** en `marketplace_campaign_detail.sql` fallan los asserts 51 y 52, y en `marketplace_campaign.sql` el 24 y el 25. Cuentan filas y la base local tiene campañas demo «Panadería Ensayo U9». Ya fallaban antes de este cambio.
- **Advisories del verificador:**
  1. Ningún test de la API sigue `useOfFunds` de punta a punta en el contexto de revisión del admin; hoy funciona porque el record pasa entero.
  2. El escaneo de términos prohibidos no cubre esta copy; se revisó a mano.
- **Campañas existentes:** no tienen el dato, así que su detalle sigue mostrando «Sin dato» hasta que una PyME nueva se registre.
- **Estado del PR:** no está mergeado al escribir esta evidencia. Falta ver el campo en el wizard desplegado.
