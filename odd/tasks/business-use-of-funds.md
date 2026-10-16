# Feature #577 — Destino de los fondos en el registro y en el detalle de campaña

Objetivo: que la PyME cuente en el paso 2 para qué necesita los fondos y que el detalle de campaña, «Ver lo enviado» y la revisión del admin lo muestren. Rama `Vaqcrow#577_Feat_Let_the_PyME_describe_the_use_of_funds_in_registration_and_show_it_on_the_campaign_detail`. Un PR (`ask-on-risk`). Runner: vitest (web/API/contracts) + pgTAP (`pnpm run test:db`).

## Specs

- **S1** — Hallazgo del owner (2026-10-16), verbatim: «en el registro de pyme en el paso 2, no encuentro el campo donde explico el Destino de los fondos que se muestra en la pagina de detalle de la campanha». Decisión del owner: texto libre (opción «b») y **obligatorio** («si»).
- **S2** — Paso 2 del wizard: textarea «Destino de los fondos», obligatorio, con un mínimo de 20 caracteres como `desc` («Contanos para qué vas a usar los fondos: al menos 20 caracteres.»), máximo de 2000 y un ejemplo en «Completar con datos de ejemplo». Si está vacío, bloquea «Continuar» con el error visible. El template no lo diseña: va con el mismo estilo que el textarea `desc`, justo debajo de él.
- **S3** — Persistencia: la columna nullable `public.businesses.use_of_funds text`, con `check (char_length(use_of_funds) <= 2000)`. Es nullable porque las filas que ya existen no tienen el dato. Viaja en `POST /businesses` (`useOfFunds`) y vuelve en `GET /businesses/mine`. **La API lo acepta pero no lo exige**: si viene, se valida (trim y máximo 2000); si no viene, queda `null`. Así, la web vieja no recibe un 400 durante el deploy. La web es la que lo exige.
- **S4** — Detalle de campaña: `marketplace_campaign_detail` agrega `use_of_funds` **al final**, después de `sales_months` (`create or replace view` con la definición completa, `security_invoker = true`, revoke/grant iguales a `20261008230000`). `campaignDetailSchema.useOfFunds: z.string().trim().min(1).nullable().optional()`. Va opcional porque Vercel despliega antes que Railway: la web nueva tiene que funcionar contra la API vieja. «Destino de los fondos» muestra el texto como párrafo (texto plano, nunca HTML) y, si falta, el «Sin dato» honesto.
- **S5** — «Ver lo enviado» (`application/company/submitted-data.ts`) suma la fila «Destino de los fondos», o «Sin dato» si falta. La revisión del admin (`AdminReviewCompany`, `parseCompany` y un bloque en la vista de revisión) muestra el texto, o «Sin dato».
- **S6** — La migración se prueba en local (pgTAP) y se aplica al remoto **antes** del merge, con autorización del owner y el historial alineado. `pnpm run verify` y `pnpm run test:db` pasan. Se regenera `apps/api/openapi.json`. Evidencia en `docs/planning/business-use-of-funds-evidence.md`.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|---|---|---|---|---|
| T1 | S3, S4 (DB) | delegada (backstop de contexto) | hecho local (remoto pendiente) | migración + pgTAP |
| T2 | S3, S4 (API/contrato) | delegada | hecho | API + contrato |
| T3 | S2, S4, S5 (web) | delegada | pendiente | wizard, detalle, enviado, admin |
| T4 | S6 | parent + verificador independiente | pendiente | verify, remoto, evidencia |

Ruta: un writer acotado hace T1–T3 en serie, porque la sesión del parent pasó el backstop de contexto (~150k). Hay riesgo alto (ítem 1: migración; ítem 3: contrato del detalle), así que va un verificador independiente.

## Log

- **L1** (2026-10-16) — Pedido: S1. El owner eligió «b» (texto libre) y confirmó «si» (obligatorio). Issue #577.
- **L2** (2026-10-16) — Mapa (explorador):
  - Hoy «Ver lo enviado» y la revisión del admin no muestran la descripción.
  - `DRAFT_KEYS` (`apps/api/src/application/use-cases/business.ts:24-34`) rechaza las claves desconocidas.
  - `campaignDetailSchema` es `strictObject` (`packages/contracts/src/campaign-detail.ts:101`).
  - `marketplace_campaign_detail` se redefinió por última vez en `20261008230000_create_business_sales_period.sql`.
  - `UsesSection` (`campaign-detail-view.tsx:160-172`) muestra «Sin dato» fijo.
  - `campaign-detail.test.tsx:286-289` fija ese «Sin dato».
- **L3** (2026-10-16) — T1 (DB). Migración `20261016165845_add_business_use_of_funds.sql` (creada con `supabase migration new`): `businesses.use_of_funds text` nullable con `businesses_use_of_funds_length_check` (`<= 2000`) y `marketplace_campaign_detail` recreada con la definición completa de `20261008230000`, `b.use_of_funds` en el lateral `company` y `company.use_of_funds` como última columna; mismos `revoke`/`grant`.
  - RED: `supabase test db --local …businesses_ownership.sql …marketplace_campaign_detail.sql` → `column "use_of_funds" … does not exist`, tests 15-17 y 33-34 fallan.
  - GREEN: `supabase migration up --local` y el mismo comando → `businesses_ownership.sql` 53/53; `marketplace_campaign_detail.sql` 96/98. Fallan solo 51-52 («only the two published campaigns are exposed» / «one row per published campaign…»), los mismos que antes eran 49/50: cuentan filas y la base local tiene campañas demo («Panadería Ensayo U9 …»). No los causa este cambio.
  - OWASP Top 10:2025: sin hallazgos (A01: la columna hereda RLS sin políticas y el grant solo a `service_role`; la vista sigue `security_invoker` y solo `service_role`).
  - El remoto no se tocó; queda para T4.
- **L4** (2026-10-16) — T1 quedó en el commit `6eb1017`. T2 (API y contrato):
  - `validateBusinessDraft` suma `useOfFunds` al allow-list `DRAFT_KEYS`. Es opcional: ausente, `null` o en blanco tras el trim → no se guarda (queda `NULL`); un no-string → `invalid`; más de 2000 → `out_of_range`. `description` sigue obligatoria (test que lo fija).
  - El adapter inserta `use_of_funds` solo si viene y lo lee nullable (se omite en el registro si es `NULL`; un no-texto es fila malformada → `unavailable`), igual que `deadline`.
  - `campaignDetailSchema.useOfFunds: z.string().trim().min(1).nullable().optional()`. El detalle lo lee con `optionalText` y el caso de uso emite `useOfFunds: record.useOfFunds ?? null`, así que la API nueva siempre lo manda (`null` = «Sin dato»).
  - Se agregó `supabase-campaign-detail-repository.test.ts`, que no existía, con el mapeo de `use_of_funds`. OpenAPI: el texto de `POST /businesses` y `GET /businesses/mine`; `openapi.json` regenerado (`useOfFunds` en el schema del detalle).
  - RED: 7 tests de `business.test.ts`, 3 del repositorio de businesses, 2 del contrato, 2 de `get-campaign-detail.test.ts` y 3 del nuevo test del adapter de detalle.
  - GREEN: `pnpm --filter @vaqcrow/contracts exec vitest run` → 762/762; `pnpm --filter @vaqcrow/api test` → 3237/3237 (164 archivos); `pnpm --filter @vaqcrow/api run typecheck` → limpio.
  - OWASP Top 10:2025: sin hallazgos. A01: el owner sigue saliendo del principal, nunca del body. A06/A05: clave desconocida → 400, tipo y largo validados, sin eco de texto de Postgres. El texto se guarda tal cual y lo escapa quien lo renderiza (T3).

