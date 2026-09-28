# Evidencia de cierre de la Feature #26 — Issue #85

> Documento de cierre de Feature. Consolida evidencia verificable de las Tasks [#83](https://github.com/reyduar/Vaqcrow/issues/83) y [#84](https://github.com/reyduar/Vaqcrow/issues/84) y registra una reproducción local sobre `7c7adfa`. No implementa un proveedor real, no altera código de runtime y no sustituye los registros de iteración [[odd/tasks/implement-monthly-sales-feed|#83]] y [[odd/tasks/test-monthly-sales-feed|#84]].

## 1. Contexto y objetivo

La Feature [#26](https://github.com/reyduar/Vaqcrow/issues/26) implementa el feed mensual de ventas de la demo: cargar el siguiente período **sintético** con procedencia por dato, un faltante conocido, una anomalía conocida y rotulado explícito `SIMULADO`. Es el paso 8 de la historia vertical de [[docs/planning/DEMO|DEMO.md]]: el feed aporta evidencia sintética claramente rotulada; no es una fuente fiscal, bancaria, de adquirente ni ERP real.

La Task [#85](https://github.com/reyduar/Vaqcrow/issues/85) cierra la evidencia: reúne el alcance entregado por [#83](https://github.com/reyduar/Vaqcrow/issues/83), sus pruebas determinísticas de [#84](https://github.com/reyduar/Vaqcrow/issues/84), las rutas de implementación y la reproducción local actual. La implementación llegó por PR [#332](https://github.com/reyduar/Vaqcrow/pull/332), merge local `166eca4`; las pruebas por PR [#333](https://github.com/reyduar/Vaqcrow/pull/333), merge local `7c7adfa`.

## 2. Cómo leer esta evidencia

- **Hechos verificados:** se derivan de los commits locales, archivos versionados y comandos de §5 ejecutados el 2026-09-28 sobre `7c7adfa`.
- **Hechos simulados de la demo:** se identifican expresamente como tales. El dataset es congelado y reproducible; su procedencia es la cadena visible `Declaración mensual sintética` y cada período lleva `SIMULADO`.
- **Trabajo futuro:** se formula como futuro y no como capacidad entregada. Las fuentes autorizadas reales son solo el reemplazo de producción previsto por `DEMO.md`.
- **Reproducción local:** los comandos no requieren Supabase, Stellar Testnet, Horizon, proveedor LLM, credenciales ni datos sensibles. `pnpm run verify` usa sus suites determinísticas; no incluye `test:integration`.

## 3. Implementación trazable

| Límite entregado | Ruta verificable | Hecho comprobado |
|---|---|---|
| Contrato compartido | `packages/contracts/src/sme-evidence.ts` | `salesPeriodSchema` estricto admite `provenance` opcional, referencia de evidencia, estado y `simuladoLabel: "SIMULADO"`; `amountArs` es `null` cuando falta el valor, nunca cero. |
| Puerto reemplazable | `apps/api/src/application/ports/sales-data-provider-port.ts` | `SalesDataProviderPort` expone `getPeriods` y `recordNextPeriod`; usa datos planos y solo los códigos sanitizados `not_found` y `unavailable`. No importa Fastify, Supabase, Stellar ni SDK de LLM. |
| Adaptador y dataset simulados | `apps/api/src/infrastructure/adapters/simulated-sales-dataset.ts`, `simulated-sales-data-provider.ts` | Ocho períodos históricos congelados y el siguiente período `2026-09`; abril conserva `amountArs: null`/`missing:2026-04`, junio conserva `anomalous` sin causa declarada, y todos los datos llevan procedencia y `SIMULADO`. El estado de registrar `2026-09` es idempotente y vive solo en memoria del proceso. |
| Superficie HTTP | `apps/api/src/infrastructure/http/routes/sales-feed.route.ts`, `apps/api/src/infrastructure/http/build-app.ts`, `apps/api/src/index.ts` | `GET /businesses/:businessId/sales-periods` devuelve la serie; `POST` en la misma ruta registra el siguiente período. POST exige exactamente `{}`: claves adicionales o ausencia de cuerpo devuelven 400 antes de invocar al proveedor. La primera aplicación devuelve 201 y la repetición idempotente 200; negocio inexistente devuelve 404 y fallo disponible solo como 503 `{ code: "unavailable" }`. |
| Paridad sin dependencia de runtime entre apps | `tests/monthly-sales-feed-parity.ts`, `tests/monthly-sales-feed-parity.test.ts` | La guardia vive exclusivamente en el harness raíz de pruebas y compara los campos compartidos de la copia API con el fixture canónico web. No añade un import de producción entre `apps/api` y `apps/web`. |

Los commits locales de la implementación son `c04de71` (contrato), `8031302` (puerto, adaptador y dataset), `b1fbac9` (rutas y wiring), `ee79d7d` (evidencia de verificación) y `4dff766` (entrega de #83). La guardia de paridad y su registro son `5ded965` y `d1ddf68` para #84.

> [!important] Límite de procedencia
> `Declaración mensual sintética` es una etiqueta de origen del fixture, no la prueba de una declaración real. La Feature no incorpora ventas reales, identidad real, PII, KYC/KYB ni persistencia durable.

## 4. Cobertura determinística

La guardia de paridad proyecta `period`, `amountArs`, `status`, `provenance`, `evidenceRef` y `simuladoLabel`. Así detecta drift entre los ocho períodos históricos de API y web, preserva abril como `null` y junio como anomalía sin inventar una causa. La importación cruzada existe solo bajo `tests/`; `pnpm run boundaries` y `pnpm run test:boundaries` la aceptan en la suite completa.

Las suites de adaptador y ruta cubren 23 escenarios: serie congelada y período siguiente; negocio inexistente (404); fallback sanitizado `unavailable` (503); aplicación inicial e idempotencia de POST; rechazo de claves extra sin llamar al proveedor; rechazo de cuerpo ausente; y la ruta no registrada cuando falta su slice opcional. Los payloads de ruta se validan contra el contrato compartido, incluido `provenance`.

## 5. Resultados de verificación observados

Reproducido localmente el 2026-09-28 sobre `7c7adfa` antes de modificar este documento:

```sh
$ pnpm exec vitest run tests/monthly-sales-feed-parity.test.ts

Test Files  1 passed (1)
     Tests  1 passed (1)
Duration  545ms
```

```sh
$ pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/adapters/simulated-sales-data-provider.test.ts src/infrastructure/http/routes/sales-feed.route.test.ts

Test Files  2 passed (2)
     Tests  23 passed (23)
Duration  761ms
```

```sh
$ pnpm run verify

Tasks:    5 successful, 5 total   # lint
Tasks:    8 successful, 8 total   # typecheck
Tasks:    8 successful, 8 total   # workspace test
Tasks:    5 successful, 5 total   # build
✔ no dependency violations found (444 modules, 1312 dependencies cruised)
Test Files  9 passed (9)
     Tests  93 passed (93)         # test:boundaries
```

El comando compuesto terminó con **exit 0**. La suite completa informó además: contratos 9 archivos/329 tests, dominio 1/60, IA 5/107, web 98/686 y API 39/709. El único warning de lint fue preexistente: `apps/web/src/infrastructure/http/fetch-http-client.ts:8`, `_request` sin usar; hubo 0 errores. Las líneas `stderr` de repositorios Supabase durante tests son fixtures de sanitización de errores, no una conexión de integración ni un fallo del gate.

## 6. Mapeo de criterios de aceptación

| Criterio (verbatim, issue #85) | Resultado |
|---|---|
| "Evidence identifies Feature #26, verification commands, and observed results." | ✅ PASS — §1 identifica Feature #26 y sus Tasks #83/#84/#85; §5 contiene los tres comandos ejecutados y sus resultados observados, incluido `pnpm run verify` con exit 0. |
| "Evidence is traceable to implementation and focused tests." | ✅ PASS — §3 vincula contrato, puerto, dataset, adaptador, rutas, composition root y guardia de paridad con sus rutas versionadas; §4 y §5 enlazan esas rutas con las suites focalizadas 1/1 y 23/23. |
| "Sensitive data and unsupported production claims are excluded." | ✅ PASS — el documento no contiene secretos, tokens, semillas, PII, XDR ni datos de una fuente viva; §§1–2 y §7 delimitan el dataset como sintético y las integraciones reales como futuras. |

## 7. Límites conocidos y trabajo futuro

1. **No hay fuente de ventas de producción.** `SalesDataProvider` permite sustituir el adaptador, pero APIs fiscales, bancarias, adquirentes o ERP con permisos y cobertura validada permanecen como reemplazos futuros en `DEMO.md`.
2. **No hay persistencia durable.** El período siguiente se conserva en memoria por proceso; reiniciar devuelve el feed al estado inicial. Esta Feature no afirma auditoría durable ni historial operativo real.
3. **La procedencia backend no se muestra aún como autoridad de UI.** El mapeador actual de web conserva su etiqueta neutral; llevar la procedencia recibida al frontend es una decisión posterior, fuera de #26.
4. **No hay capacidad de IA, KYC/KYB ni Stellar en este slice.** La IA sigue siendo solo asesora, no aprueba ni calcula obligaciones ni mueve fondos; ninguna transacción de Stellar Testnet, Horizon, wallet, Supabase ni servicio LLM fue ejecutado para esta evidencia.

> [!warning] Alcance de la demo
> La simulación demuestra una interfaz y un contrato reemplazable, no disponibilidad, legalidad, SLA, calidad de un proveedor real ni operación financiera en Argentina. Vaqcrow continúa siendo una demostración no apta para producción.

## 8. Estado de entrega

Los merges locales `166eca4` y `7c7adfa` confirman que #83 y #84 están incorporados a la base actual. Esta Task #85 aporta el documento de cierre y conserva su rama propuesta hasta que el flujo de revisión y merge ocurra; no se presenta como entregada por este documento. La frontera de rollback de esta unidad es exclusivamente documental: `docs/planning/monthly-sales-feed-evidence.md`, el ajuste de roadmap de #83/#84 y `odd/tasks/document-evidence-for-monthly-sales-feed.md`.

### Próximo paso

Revisar y mergear la unidad documental de #85. Solo después podrá cerrarse la Feature #26 y habilitarse el trabajo de #27; ese cierre no se afirma aquí como realizado.
