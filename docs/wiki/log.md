# Bitácora de la wiki del asistente

En orden cronológico inverso. Una entrada por corrida. Prefijos: `ingest`, `lint`, `human`.

## 2026-10-15 — ingest: Freighter y Friendbot (#558)

- Fuente nueva: `blog/freighter-y-friendbot-paso-a-paso.md` (Blog), junto con `freighter-and-testnet-walkthrough.md`.
- Página nueva `freighter-y-friendbot.md` (flujo): instalar Freighter en Chrome, crear la cuenta, pasar a Testnet, conectar en Vaqcrow y fondear con Friendbot, con una tabla para cuando el saldo no aparece. Indexada después de `freighter-y-firmas`.
- Lint nuevo en la API (`wiki-corpus.test.ts`): índice ↔ archivos sin huérfanas, `type` del esquema y `sources` existentes en `docs/guides/`.

## 2026-10-14 — ingest inicial

- Se compilaron 16 páginas desde 3 fuentes de `docs/guides/`: `como-funciona-vaqcrow.md`, `freighter-and-testnet-walkthrough.md` y `blog/vaqcrow-sobre-stellar.md`.
- Por tipo: `revenue-share` y `todo-o-nada` (concepto); `alta-de-pyme`, `aporte-del-inversor` y `distribucion-mensual` (flujo); `boveda-soroban` y `freighter-y-firmas` (tecnología); `mi-campana`, `explorar-pymes`, `mi-portafolio`, `reports`, `detalle-de-campana`, `centro-de-ayuda`, `guia-del-inversor` y `guia-para-emprendedores` (pantalla); `que-es-real-y-que-es-simulado` (límite).
- Abiertas (grounding blando): `centro-de-ayuda.md`, `guia-del-inversor.md`, `guia-para-emprendedores.md` y `reports.md` — el texto propio de estas pantallas vive en el código (`/help` y las guías, Feature #394; `/reports`, Feature #430), no en `docs/guides/`. Cada página describe qué es y qué hace la pantalla y los temas que cubre, apoyada en las guías fuente que cubren esos temas.
- Abiertas: `docs/guides/storybook.md` queda fuera de la wiki por la decisión D1 del esquema (guía para desarrolladores).
