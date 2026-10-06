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
- [ ] **T2 — R3-1: acotar el fan-out.** Tope de filas + concurrencia acotada + deadline global (reloj inyectable). Tests: deadline vencido → `content_unverified`; más filas que el tope; concurrencia no serial. Commit.
- [ ] **T3 — R3-2: tope de tamaño de imagen.** Guarda explícita en la rama de imagen; test de borde (justo en el tope y por encima). Commit.
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
