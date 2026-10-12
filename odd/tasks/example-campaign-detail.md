# Bitácora — Detalle sintético desde la card destacada

## Objetivo

Task [#481](https://github.com/reyduar/Vaqcrow/issues/481): que el CTA «Ver evidencia y riesgo» de la card destacada **placeholder** («Panadería Horizonte SRL», que se muestra cuando no hay campaña publicada) abra una página de detalle **sintética** con el mismo layout que `/campaigns/[id]`, para que un visitante vea cómo es esa página.

## Por qué

`featured-campaign.tsx` renderizaba el placeholder con su CTA apuntando a `/explore`, que en esa situación también está vacío: un link muerto.

## Rama

- **Rama:** `Vaqcrow#481_Task_Link_the_placeholder_featured_card_to_a_synthetic_campaign_detail_page` (off `main`).

## Decisión del owner (2026-10-12)

La página de ejemplo es **pública** (sin cuenta). El owner además pidió que el **detalle real** (`/campaigns/[id]`) sea público y compartible por link; eso **excede** este Task (toca la política de la API, la privacidad del `actor` admin y la plantilla), así que se separó en un issue nuevo: **Feature #485**. Este Task sólo hace público el **ejemplo**.

## Unidad de trabajo

- [x] **U1 — Página de ejemplo + link.** RED: test que exige que el CTA del placeholder apunte a `/campaigns/example` (falla: apuntaba a `/explore`), y un test nuevo de la página de ejemplo (falla: el componente no existía). GREEN:
  - `apps/web/src/application/campaign/example-campaign.ts` — fixture puro (sin React): `EXAMPLE_CAMPAIGN_PATH = "/campaigns/example"`, la copy del aviso y `EXAMPLE_CAMPAIGN_DETAIL: CampaignDetail` con identidad coherente con el placeholder (mismo nombre, imagen y números titulares). El `vaultAddress` es `null` a propósito: **nada de un hash o link de Testnet presentado como real**. El `decision.actor` es «Administración Vaqcrow» (etiqueta neutra sintética, no el nombre de una persona).
  - `apps/web/src/presentation/components/campaign-detail/example-campaign-detail.tsx` — reutiliza el `CampaignDetailView` real con `role={null}` (así no se montan aporte ni retiro), más un banner «Página de ejemplo» y la nota de que no se puede aportar.
  - `apps/web/src/app/campaigns/example/page.tsx` — ruta pública dentro de `<AppShell>`; el segmento estático `example` gana sobre el dinámico `[id]`.
  - `featured-campaign.tsx` — el CTA del placeholder pasa de `/explore` a `EXAMPLE_CAMPAIGN_PATH`.

## Cumplimiento de los criterios de aceptación

- **Sin campaña publicada, el CTA del placeholder abre la página sintética** → test del href + ruta emitida en el build.
- **Renderiza todas las secciones con datos sintéticos y marcas `SIMULADO`** → test de secciones (Sobre la PyME, Evidencia de ventas, Recomendación de IA, Decisión humana) y marcas `SIMULADO`.
- **Ninguna acción llama a la API ni a Stellar** → la página no recibe ningún port; el `CampaignDetailView` con `role={null}` no monta aporte ni retiro.
- **`pnpm run verify` pasa** → ver abajo.

## Verificación

- Tests: `featured-campaign.test.tsx` (5) y `example-campaign-detail.test.tsx` (5) verdes; suite web completa **217 archivos / 2179 tests**.
- **Build**: la ruta se emite como estática (`○ /campaigns/example`) y el dinámico queda aparte (`ƒ /campaigns/[id]`); el HTML prerenderizado contiene «Página de ejemplo», el nombre de la PyME, `SIMULADO` y la nota de aporte. El bundle del landing referencia `/campaigns/example`.
- `pnpm run typecheck` y `pnpm run boundaries` → limpios; `pnpm run verify` → **EXIT 0**, tareas 5/8/8/5 verdes (los «2 problems» de lint son los dos warnings preexistentes de `admin-users.test.tsx`, 0 errores).

## Diferido

**Feature #485** — «Publish the campaign detail publicly as a shareable link»: hacer público el detalle **real**, con las preguntas abiertas (publicar o neutralizar el `actor` admin, retirar el gate de la plantilla, campos a retener).
