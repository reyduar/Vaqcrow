# Bitácora de la wiki del asistente

En orden cronológico inverso. Una entrada por corrida. Prefijos: `ingest`, `lint`, `human`.

## 2026-10-17 — ingest: el ecosistema Stellar de Vaqcrow (#599)

- Fuente nueva citada: `blog/ecosistema-stellar-de-vaqcrow.md` (Blog).
- Página nueva `ecosistema-stellar.md` (tecnologia): las piezas (Stellar, Testnet, XLM, Soroban, bóveda, fábrica, Freighter, Horizon y RPC, explorador), la custodia del contrato, las reglas del aporte, los dos caminos de la meta, el revenue share y una capa para developers (Rust, funciones de los contratos, despliegue y el recorrido contracts → API → web).
- `index.md`: alta de la línea de `ecosistema-stellar`, antes de `boveda-soroban`.

## 2026-10-17 — lint: encabezado de bóveda sin término prohibido (#594)

- `boveda-soroban.md`: el encabezado «## Qué garantiza» se reescribió como «## Qué reglas ejecuta la bóveda». El contenido de la sección no cambió: sigue describiendo el destino inmutable, que sólo el contrato mueve los aportes, que nadie tiene la clave durante la campaña y que el todo o nada lo ejecuta el contrato. Se actualizó `updated`.
- Lint: se retiró la exención declarada de ese encabezado en `tests/wiki-public-copy.test.ts`, así que el corpus escanea la página entera sin excepción. Una exención de encabezado dejaba al asistente libre de reformular la afirmación con sus propias palabras; reescribirlo elimina el término prohibido en origen, no en la exención.

## 2026-10-16 — lint: lista de copy pública y tope de aportes (#582, #590)

- `index.md`: se reescribió la línea de `boveda-soroban` para no usar un término prohibido de la copy pública; sigue siendo una sola línea de router con el mismo sentido.
- Lint nuevo en `tests/`: el corpus completo (`docs/wiki/`, páginas e `index.md`) se escanea contra la misma lista de términos prohibidos que la copy pública. Las negaciones legítimas y el encabezado descriptivo de `boveda-soroban.md` quedan declarados y verificados por archivo.
- `todo-o-nada.md`: se corrigió la frase que atribuía al contrato todas las reglas de aportes. El cierre por «Meta alcanzada» lo aplica el contrato; el tope que impide aportar más de lo que falta lo aplica Vaqcrow antes de firmar, como dice la divulgación `contribution-over-goal`. Se actualizó `updated`.
- Alcance del lint: `apps/web/src/application/trust/disclosures.ts` queda fuera. Sus siete textos son las divulgaciones canónicas aprobadas y ya están fijados literalmente por `tests/trust-disclosures-canonical-consistency.test.ts`; sus términos aparecen sólo en negaciones, así que pasarlos por la lista obligaría a una exención grande que debilitaría el guard.

## 2026-10-16 — ingest: tope del revenue share a 1,5× (#580)

- Fuente citada: `blog/revenue-share-explicado.md` (Blog), junto con `como-funciona-vaqcrow.md`.
- Página `revenue-share.md` (concepto): se reescribió la sección del tope con lo que la regla sí fija —cada inversor cobra hasta 1,5 veces lo aportado, el acuerdo termina al alcanzarlo y el plazo de 3 a 5 años queda declarado como límite no implementado en la demo—; se eliminó la frase que decía que no había un total a devolver ni una fecha de fin.
- Versión de la regla actualizada a `RS-2026-02` en `revenue-share.md`, `distribucion-mensual.md` y las fuentes de `docs/guides/`.

## 2026-10-16 — ingest: revenue share en lenguaje llano (#579)

- Fuente nueva citada: `blog/revenue-share-explicado.md` (Blog), junto con `como-funciona-vaqcrow.md`.
- Página ampliada `revenue-share.md` (concepto): explicación en lenguaje llano con una analogía cotidiana, un glosario que define cada término la primera vez que aparece, y el mes paso a paso; se conserva lo que ya era correcto.
- Línea del índice reescrita para seguir describiendo el concepto sin pisar la de `distribucion-mensual.md`.

## 2026-10-15 — ingest: Freighter y Friendbot (#558)

- Fuente nueva: `blog/freighter-y-friendbot-paso-a-paso.md` (Blog), junto con `freighter-and-testnet-walkthrough.md`.
- Página nueva `freighter-y-friendbot.md` (flujo): instalar Freighter en Chrome, crear la cuenta, pasar a Testnet, conectar en Vaqcrow y fondear con Friendbot, con una tabla para cuando el saldo no aparece. Indexada después de `freighter-y-firmas`.
- Lint nuevo en la API (`wiki-corpus.test.ts`): índice ↔ archivos sin huérfanas, `type` del esquema y `sources` existentes en `docs/guides/`.

## 2026-10-14 — ingest inicial

- Se compilaron 16 páginas desde 3 fuentes de `docs/guides/`: `como-funciona-vaqcrow.md`, `freighter-and-testnet-walkthrough.md` y `blog/vaqcrow-sobre-stellar.md`.
- Por tipo: `revenue-share` y `todo-o-nada` (concepto); `alta-de-pyme`, `aporte-del-inversor` y `distribucion-mensual` (flujo); `boveda-soroban` y `freighter-y-firmas` (tecnología); `mi-campana`, `explorar-pymes`, `mi-portafolio`, `reports`, `detalle-de-campana`, `centro-de-ayuda`, `guia-del-inversor` y `guia-para-emprendedores` (pantalla); `que-es-real-y-que-es-simulado` (límite).
- Abiertas (grounding blando): `centro-de-ayuda.md`, `guia-del-inversor.md`, `guia-para-emprendedores.md` y `reports.md` — el texto propio de estas pantallas vive en el código (`/help` y las guías, Feature #394; `/reports`, Feature #430), no en `docs/guides/`. Cada página describe qué es y qué hace la pantalla y los temas que cubre, apoyada en las guías fuente que cubren esos temas.
- Abiertas: `docs/guides/storybook.md` queda fuera de la wiki por la decisión D1 del esquema (guía para desarrolladores).
