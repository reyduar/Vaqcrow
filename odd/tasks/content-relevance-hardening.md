# Bitácora: endurecimiento del chequeo de contenido (hallazgos RDD de S4)

> Unidad de trabajo posterior a la feature de **relevancia por contenido (visión)** de [#402](https://github.com/reyduar/Vaqcrow/issues/402). Cierra los cuatro hallazgos **non-blocking** que dejó la revisión RDD de la rebanada S4 (`review-a7fb517f7003089c`), sin abrir una corrección de review (ninguno bloqueaba). Continúa la bitácora [[odd/tasks/content-relevance-vision]] y su evidencia [[docs/planning/content-relevance-vision-evidence]].

## Objetivo

Cerrar los cuatro hallazgos de S4 sobre `apps/api/src/infrastructure/adapters/content-aware-completeness-check-adapter.ts`:

| # | Severidad | Hallazgo |
|---|---|---|
| R3-1 | WARNING | El paso de contenido recorre las filas del owner **en serie, sin tope de filas ni deadline global**; la ruta espera todo antes de responder. Un set grande o lento (o un timeout por documento) puede exceder el presupuesto de request y surface como fallo genérico en vez de los findings no bloqueantes. |
| R3-2 | WARNING | La rama de **imagen** hace base64 de los bytes descargados **sin redimensionar ni validar tamaño** (el bucket acepta hasta 10 MB), mientras la rama PDF pasa por el rasterizador. Una foto grande podría rechazarse/timeoutear y degradar a `content_unverified`, justo en las fotos más grandes. Sin test de imagen grande. |
| R3-3 | SUGGESTION | Los `await` por fila **no tienen `try/catch`**: un puerto que **rechace** (en vez de devolver `ok:false`) propaga y la ruta lo convierte en `503`, descartando los findings declarados ya calculados. |
| R3-4 | SUGGESTION | Cada fila produce su propio finding y el `detail` de `content_irrelevant` sale solo de la etiqueta por kind, así que **varias fotos irrelevantes dan findings byte-idénticos**, indistinguibles y sin deduplicar. |

## Por qué

La revisión nativa de la feature aprobó el alcance (S1–S4 con autoridad quemada) pero dejó estos cuatro puntos como **trabajo posterior**. No bloquean la demo, pero R3-3 es un camino real a perder findings ya calculados y R3-1/R3-2 afectan al peor caso (set grande / foto grande). El owner pidió cerrarlos.

## Alcance

- **Dentro:** el adaptador content-aware (`content-aware-completeness-check-adapter.ts`), sus tests, y —si hace falta— el wiring en `index.ts` para inyectar un reloj/deadline.
- **Fuera:** el chequeo determinista, la ruta HTTP, el gateway web, la copy ya aprobada (salvo que el owner decida lo contrario para R3-4), y cualquier cambio de contrato del puerto `CompletenessCheckPort`.

## Restricciones

- La IA sigue siendo **solo asesora**: un fallo **nunca** bloquea el envío ni tira el chequeo; degrada a `content_unverified` (`warning`).
- **Nunca un pase silencioso**: lo que no se puede juzgar se declara.
- El `ownerUserId` sigue saliendo del principal verificado, nunca del body.
- Nada llega a `main` hasta [#438](https://github.com/reyduar/Vaqcrow/issues/438) (Opción A del owner).

## Criterios de aceptación

1. Un puerto que **rechaza** (no `ok:false`) no rechaza `check`: el documento degrada a `content_unverified` y los findings declarados ya calculados se conservan (R3-3).
2. El paso de contenido **acota** su trabajo: tope de filas procesadas, concurrencia acotada y un **deadline global** tras el cual lo no juzgado se declara `content_unverified` (R3-1).
3. La rama de imagen tiene un **tope de tamaño explícito y testeado**: una imagen por encima del tope degrada a `content_unverified` de forma determinista, no por rechazo del proveedor (R3-2).
4. Varias fotos irrelevantes producen una salida **no ambigua** (decisión del owner sobre la copy o deduplicación) (R3-4).
5. `pnpm run verify` completo en verde; suites API/web y `test:boundaries` sin regresiones.

## Tareas

- [x] **T1 — R3-3: aislar rechazos por documento.** `try/catch` alrededor de `listByOwner` y de cada `checkDocument`; un rechazo se convierte en el mismo `content_unverified` que un `ok:false`. Tests: un doble que **rechaza** en descarga/rasterizado/visión/lista. Commit.
- [x] **T2 — R3-1: acotar el fan-out.** Tope de filas + deadline global (reloj inyectable). **Concurrencia diferida a propósito** (es una optimización de latencia, no lo que pide el hallazgo, y agrega riesgo de determinismo). Tests: deadline vencido → `content_unverified`; más filas que el tope. Commit.
- [x] **T3 — R3-2: tope de tamaño de imagen.** Guarda explícita en la rama de imagen; test de borde (justo en el tope y por encima). Commit.
- [ ] **T4 — R3-4: findings de fotos no ambiguos.** Decisión del owner (copy o dedupe) + test de dos fotos irrelevantes. Commit.
- [ ] **T5 — Verificación + evidencia.** `pnpm run verify` completo; actualizar la evidencia de visión y esta bitácora. Commit.

## Checks

- `pnpm --filter @vaqcrow/api test` (suite API).
- `pnpm --filter @vaqcrow/web exec vitest run` (suite web, si T4 toca la web).
- `pnpm run verify` (lint + typecheck + test + build + boundaries + test:boundaries) antes de cerrar.
- `git diff CLAUDE.md AGENTS.md` → idénticos (si se tocan los gemelos).

## Progreso

_(se completa a medida que avanza cada tarea; una entrada por unidad de trabajo con el hash del commit)_

### T1 — R3-3: aislar rechazos por documento (commit: este work unit)

- **RED.** Cinco casos nuevos en `content-aware-completeness-check-adapter.test.ts` (un `describe` «rejected ports (R3-3)»): `listByOwner` que rechaza; descarga que rechaza; rasterizador que rechaza; visión que rechaza; y un rechazo que debe **conservar** el finding declarado ya calculado (`missing_document`). Con el código previo: **5 failed | 14 passed (19)** — el rechazo propagaba desde `check` y `checkDocument`.
- **GREEN.** `listByOwner` envuelto en `try/catch` → entra por un `degradeListRead()` idéntico al camino `!listed.ok` (mismo `UNVERIFIED_LIST_COPY`, sin bloquear). Cada `await checkDocument(...)` envuelto en `try/catch` → empuja `unverifiedDocumentFinding(record.kind)`, el mismo finding que produce un `ok:false` interno; los findings ya calculados se preservan. Se extrajo `unverifiedDocumentFinding(kind)` para que ambos caminos emitan copy idéntica. Contrato del puerto, copy y comportamiento ante `ok:false`: sin cambios.
- **Verificación.** `vitest run` del archivo → **19 passed (19)**; `pnpm --filter @vaqcrow/api test` → **83 files / 1882 passed**; `pnpm run typecheck` → **8 ok**; `pnpm run lint` → **5 ok** (0 errores; 1 warning preexistente en `apps/web`).
- **Nota de comando.** La suite de `apps/api` corre con cwd en el workspace, así que la ruta del archivo es `src/infrastructure/adapters/...` (no `apps/api/src/...`).

### T2 — R3-1: tope de filas + deadline global (commit: este work unit)

- **RED.** Tres casos nuevos en un `describe` «bounded content pass (R3-1)»: tope de filas (9 filas → 8 juzgadas + 1 warning de lista), deadline vencido (`deadlineMs: 0` → ningún puerto tocado, todos degradan, declarados preservados) y guard de no-regresión (deadline vigente → se juzgan todos). Salida real: **2 failed | 20 passed (22)** — el tercero ya pasaba (sin deadline hoy juzga los 3 igual), así que es guard, no rojo. No se forzó.
- **GREEN.** `MAX_DOCUMENTS_CHECKED = 8` y `DEFAULT_DEADLINE_MS = 8_000` (por debajo del timeout de 10 s del cliente web). Las dependencias ganaron `now?` y `deadlineMs?` **opcionales** (los callers actuales, incluido `index.ts`, no cambian). `deadlineAt = now() + deadlineMs` se resuelve **una vez** después de leer la lista; se procesan `listed.value.slice(0, MAX_DOCUMENTS_CHECKED)`; si la lista excede el tope se empuja **un** `content_unverified` reusando `UNVERIFIED_LIST_COPY`; en el loop secuencial, `now() >= deadlineAt` declara la fila `content_unverified` **sin tocar ningún puerto**. El `try/catch` de T1 y el orden de findings quedan intactos.
- **Decisión de diseño.** **Sin concurrencia**: el hallazgo pide tope + deadline, y el deadline ya acota el peor caso por debajo del timeout del cliente. La concurrencia queda como optimización futura (bajar la latencia típica), no como parte de este cierre.
- **Verificación.** `vitest run` del archivo → **22 passed (22)**; `pnpm --filter @vaqcrow/api test` → **83 files / 1885 passed**; `pnpm run typecheck` → **8 ok**; `pnpm run lint` → **5 ok** (0 errores; 1 warning preexistente).

### T3 — R3-2: tope de tamaño de imagen (commit: `dc8dab6`)

- **RED.** Se agregó primero el caso de una imagen de `4 MiB + 1` bytes y falló como esperaba: el camino anterior todavía llamaba a visión (**1 expected failure; 23 passed**).
- **GREEN.** La rama de imagen comprueba `downloaded.value.bytes.byteLength` antes de convertir a base64. Una imagen de hasta `4 * 1024 * 1024` bytes sigue el camino normal; una mayor degrada a un único `content_unverified` (`warning`) sin invocar visión. Los PDFs mantienen su ruta de rasterización sin cambios.
- **Verificación.** `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/adapters/content-aware-completeness-check-adapter.test.ts` → **24 passed (24)**; los tests cubren el borde exacto y el primer byte por encima.
- **Deuda residual.** El guard evita enviar imágenes grandes al modelo, pero no las redimensiona; un downscaler WASM sigue siendo una optimización futura fuera de este cierre.

## Estado al 2026-10-06 (fallback local; mirror Engram pendiente)

> [!warning] Espejo Engram pendiente
> `mem_session_summary` (×2) y `mem_save` (×1) fallaron con `could not confirm Engram session registration`. `mem_doctor` reporta el store sano (**9/10 checks OK**; `ambiguous_active_runtime_sessions` e `invalid_session_identity` en OK) y **un** error ajeno a esta escritura: el target de sync `cloud:vaqcrow` tiene **2371 mutaciones sin confirmar**, más targets colgados (`cloud:/`, `cloud:arielduarte`, `cloud:news-reader-app`, `cloud:scratch-2026-09-10-dddd53`). No se inventó ni registró un `session_id` para destrabarlo. **Este bloque es el registro local hasta que el mirror a Engram se pueda escribir.**

**Rama / HEAD.** `Vaqcrow#402_Feat_Run_the_AI_completeness_check_and_submit_to_human_review` en `f30f9c7`. Nada llega a `main` hasta [#438](https://github.com/reyduar/Vaqcrow/issues/438) (Opción A del owner).

**Revisión RDD de la feature de visión — cerrada.** Cinco slices sobre `122f713..b817074`: S1 `review-c09e239e893d1507`, S2 `review-0837c1eec97116ef`, S3 `review-1d41600d7f2239ab`, S4 `review-a7fb517f7003089c` — los cuatro **aprobados + acknowledged** (autoridad quemada), ninguno abrió corrección. **S5** (`bc7feb0..b817074`, 272 líneas) devolvió `review_due: false` / `under_budget` ⇒ **no revisado, pendiente**; su envelope de consentimiento se descartó sin START (sin autoridad creada). **14 hallazgos non-blocking** (3+3+4+4). Outcome registrado en [[docs/planning/content-relevance-vision-evidence]] §7/§9/§10 y en [[odd/tasks/content-relevance-vision]] → commit `3467bd9`.

**Endurecimiento de S4 — estado por tarea.**

| Tarea | Estado | Commit | Notas |
|---|---|---|---|
| T1 (R3-3) | ✅ hecho | `34c02a1` | `try/catch` en `listByOwner` y por documento; un rechazo degrada como `ok:false`. RED 5/19 → GREEN 19; API 83/1882. |
| T2 (R3-1) | ✅ hecho | `f30f9c7` | `MAX_DOCUMENTS_CHECKED = 8`, `DEFAULT_DEADLINE_MS = 8_000`, `now?`/`deadlineMs?` opcionales. Concurrencia **diferida a propósito**. RED 2/22 → GREEN 22; API 83/1885. |
| T3 (R3-2) | ✅ hecho | `dc8dab6` | `MAX_IMAGE_BYTES = 4 * 1024 * 1024` en la rama de imagen; el borde exacto se procesa y el primer byte extra degrada de forma determinista a `content_unverified` sin llamar a visión. Downscaler WASM queda como deuda futura. |
| T4 (R3-4) | 🔲 pendiente | — | **Requiere decisión del owner**: distinguir fotos por nombre de archivo (cambia la copy ya aprobada) vs deduplicar findings idénticos. |
| T5 | 🔲 pendiente | — | `pnpm run verify` completo + evidencia/bitácora. |

**Gotchas acumulados.**
- El prompt del reviewer es **una línea de ~450 bytes** (`GENTLE_AI_REVIEW_BINDING {...}`); el hook de transporte materializa el contexto congelado. Un prompt gigante reconstruido rompe el JSON de la tool (`SchemaError(Missing key ["subagent_type"])`); `subagent_type` debe setearse explícito.
- La suite de `apps/api` corre con cwd en el workspace: la ruta es `src/infrastructure/adapters/...`, **no** `apps/api/src/...`.
- `.env.docker.example` (template versionado) **no** tenía `LLM_VISION_MODEL`; sí lo tienen `.env.cloud.example` (línea 65) y los `.env.docker`/`.env.cloud` locales. El operador ya lo agregó al template, **sin commitear**.
- Dobles `vi.fn(async () => result)` **no** cubren un puerto que *rechaza* (ese es R3-3).

**Pendiente operativo.** Primer envío real por Resend de `admin.new_application` cuando la pila llegue a la demo.
