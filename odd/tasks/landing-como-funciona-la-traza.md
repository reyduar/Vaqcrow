# Bitácora — «Cómo funciona» de la landing: «La traza»

## Objetivo

Task [#497](https://github.com/reyduar/Vaqcrow/issues/497): que la sección «Cómo funciona» de la landing explique el recorrido completo de una campaña —de la solicitud de la PyME al reparto mensual— para que una persona que entra por primera vez entienda la operación.

## Por qué

El template de Claude Design traía cuatro pasos («La PyME presenta evidencia», «La IA ordena; una persona decide», «Los aportes van a una bóveda», «La distribución se calcula y se firma») que saltean el onboarding, la wallet, la creación de la bóveda, la publicación, la regla todo o nada y el cálculo de las recompensas. El owner (2026-10-13) los consideró demasiado escuetos y pidió rediseñar la sección, apartándose del template en ese punto.

## Rama

- **Rama:** `Vaqcrow#497_Task_Expand_the_landing_How_it_works_section_to_the_full_end_to_end_workflow` (off `main`).

## Decisiones de implementación

**1. Override acotado del template.** Registrado en `AGENTS.md` + `CLAUDE.md` (gemelas, byte-idénticas) y en `docs/design/demo-ui.md`. La excepción es **solo esa sección**: el template sigue siendo la fuente visual de verdad en el resto, y las reglas de confianza de §2 —que no son estética— siguen prevaleciendo. También quedó anotado el alcance real de «crowdequity»: en este encuadre describe el perfil del inversor, **no** que la recompensa sean acciones (la recompensa es revenue share).

**2. Un documento, una fuente.** El texto vive en `docs/guides/como-funciona-vaqcrow.md` (una sección por etapa, más un encabezado que ubica a Vaqcrow entre crowdfunding, crowdequity y crowdlending). Es la misma fuente que van a consumir el centro de ayuda y el corpus del asistente, así que no hay copia duplicada.

**3. Mecanismo de entrega: opción A (build).** El owner eligió que el `.md` se lea en build y no que lo sirva la API. El unit compartido es el **lector** (`apps/web/src/infrastructure/guides/read-guide-source.ts`), que resuelve la raíz del repo subiendo hasta `pnpm-workspace.yaml` —no contando `..`— y rechaza cualquier nombre que no sea un archivo suelto. La página `/` sigue prerenderizada (verificado en el build).

**4. El diseño es mapeo, no volcado de HTML.** «La traza» no renderiza Markdown crudo: un parser puro en `application/landing/how-it-works.ts` convierte el documento en etapas, y la sección le agrega solo el icono y el badge de confianza de cada una. Así se respeta el diseño (la traza, la bifurcación) sin abrir una superficie de HTML no confiable.

**5. Números y orden por contrato.** `HOW_IT_WORKS_KINDS` (una entrada por sección del doc, en orden) marca qué etapa es un paso, cuál es la bifurcación y cuáles son sus dos ramas. Un test fija títulos, orden y tipos: si alguien reordena el documento, falla en CI en vez de renderizar el badge equivocado.

**6. El mapa de confianza, atado al texto.** Cada etapa declara su naturaleza con un badge (KYC simulado, no custodial, contrato en Testnet, lo firma el inversor…). Un test exige que **todo** badge `simulado` esté respaldado por el propio texto de la etapa (`demo-ui.md` §2), así el badge no puede sobrevivir a un cambio de contenido.

**7. Un solo momento de movimiento.** La línea se dibuja una vez, la primera vez que la sección entra en el viewport: una animación CSS (`--animate-traza` en `globals.css`) disparada por una isla cliente mínima que solo cambia un atributo. La línea está visible por defecto, así que **sin JavaScript o sin `IntersectionObserver` la sección se ve igual, ya dibujada**, y `motion-reduce:animate-none` la apaga. No hay fade por ítem.

## Unidades de trabajo

- [x] **WU1 — El documento.** `docs/guides/como-funciona-vaqcrow.md`: 13 etapas, del alta de la PyME al reparto, con el encuadre de mercado. Cada afirmación sale del comportamiento real de la app (KYC y KYC del inversor simulados, uploads reales a un bucket privado, IA asesora, aprobación humana con nombre/razón/fecha, bóveda Soroban, detalle público, todo o nada, `RS-2026-01` al 4,5 % pro-rata, firma la PyME en Freighter, no custodial, sin clawback).
- [x] **WU2 — Parser + lector.** `application/landing/how-it-works.ts` (parser puro + `parseInline` para `**negrita**` y `` `código` ``) e `infrastructure/guides/read-guide-source.ts`.
- [x] **WU3 — La sección.** `presentation/components/landing/how-it-works.tsx` reescrito como «La traza», más `reveal-on-scroll.tsx` y la animación en `globals.css`. El ancla `#como-funciona` y sus enlaces siguen funcionando.
- [x] **WU4 — Las gemelas y el diseño.** `AGENTS.md` + `CLAUDE.md` + `docs/design/demo-ui.md`.
- [x] **WU5 — Verificación + esta bitácora.**

## Evaluación de seguridad (`owasp-security`, la regla que entró en #502)

El cambio toca dos superficies: **lee un archivo** y **renderiza contenido no confiable**. Evaluación contra OWASP Top 10:2025:

- **A01 — Broken Access Control (path traversal).** El lector rechaza cualquier nombre con `/`, `\` o `..` y solo resuelve dentro de `docs/guides/`. Test con `../package.json`, `../../etc/passwd`, `sub/file.md` y `a\b.md`. **Sin hallazgo.**
- **A05 — Injection (XSS).** No hay HTML: el Markdown se parsea a texto y se renderiza como nodos React (`** → <strong>`, `` ` → <code> ``). Nunca hay `dangerouslySetInnerHTML` ni ejecución de marcado del documento. **Sin hallazgo.**
- **A10 — Mishandling of Exceptional Conditions.** El lector falla cerrado: un nombre inválido lanza, no devuelve el archivo equivocado. **Sin hallazgo.**

Un test lo caza temprano: el lead de la sección seguía renderizando el texto crudo (con `**` a la vista) hasta que el caso «inline markup as elements, never as literal markers» falló. Es exactamente el tipo de defecto que esta regla busca antes de mirar una pantalla.

## Verificación

- `pnpm run verify` → **EXIT=0**. `@vaqcrow/web`: 222 archivos de test, 2198 tests. `depcruise`: sin violaciones (1252 módulos).
- `pnpm --filter @vaqcrow/web run build` → `✓ Compiled successfully`; `/` sigue siendo **estática** (`○ /`), o sea que la lectura del `.md` ocurre en build y no hay dependencia de filesystem en runtime.
- `diff -q AGENTS.md CLAUDE.md` → idénticas.
- El texto del documento corre por el mismo denylist de términos prohibidos que el resto de la copy pública (`public-copy-prohibited-terms.test.ts`).

## Arreglos de paso (mismo PR)

- **Los dos guides citaban una regla que no existe.** `investor-guide.ts` y `entrepreneur-guide.ts` mostraban `(regla rs-v1.2)`, texto de ejemplo del template: **`rs-v1.2` no existe en el código**. La versión canónica es `RS-2026-01` (`packages/domain/src/revenue-share.ts`, fijada por `demo-ui.md` §10.2). Es una afirmación falsa en copy pública, así que se corrigió en ambos y se agregó `application/guides/revenue-share-rule-version.test.ts`, que la fija: un guide que cite otra versión falla. (`apps/web` no puede importar `packages/domain` por dependency-cruiser, así que la versión se fija como literal, documentado en el test.)
- **El README declaraba un conteo de tests viejo.** Decía `190 archivos de test` (el mismo número, sin verificar, en `docs/presentation/demo-deck.md`). Re-derivado de la corrida final de `pnpm run verify` del 2026-10-13: **403 archivos / 6.161 casos** por `pnpm run test` (domain 3, contracts 26, ai 9, api 142, web 223). Reemplazado en los dos documentos y anotado con la fecha de medición.

## Lo que queda para el ojo humano

- **Revisión visual en el navegador**: no vi la sección renderizada. Lo verificado por código es estructura, orden, badges, ausencia de marcado literal y build estático; el juicio estético (proporciones de la traza, la bifurcación en desktop y en mobile, el dibujo al scrollear) queda para el owner.
- El diseño se aprobó con 8 etapas lineales; quedaron **9** (el onboarding y la wallet del inversor se separaron del aporte, porque el issue los pide como etapas distintas). Sin impacto en la dirección acordada.
- El estado del tablero ya está sincronizado en `docs/planning/demo-tasks-list.md` (238 `Done`, 6 `Backlog`, 1 `In review`) y el README referencia este documento de guía.
