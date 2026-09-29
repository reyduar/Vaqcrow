# Evidencia de cierre de la Feature #27 — Issue #88

> Documento de cierre de Feature. Consolida evidencia verificable de las Tasks [#86](https://github.com/reyduar/Vaqcrow/issues/86) y [#87](https://github.com/reyduar/Vaqcrow/issues/87) y registra una reproducción local sobre `e81e8e8`. No conecta el motor a rutas HTTP, persistencia ni Stellar, no altera código de runtime y no sustituye los registros de iteración [[odd/tasks/deterministic-revenue-share-calculation|#86]], [[odd/tasks/test-deterministic-revenue-share-calculation|#87]] y [[odd/tasks/document-evidence-for-deterministic-revenue-share-calculation|#88]].

## 1. Contexto y objetivo

La Feature [#27](https://github.com/reyduar/Vaqcrow/issues/27) implementa el cálculo determinístico de la obligación de revenue share: la obligación se computa con enteros y unidades mínimas, una regla versionada y una política de redondeo explícita. Es el paso 9 de la historia vertical de [[docs/planning/DEMO|DEMO.md]]: la IA no calcula la obligación, no la aprueba ni mueve fondos.

La Task [#88](https://github.com/reyduar/Vaqcrow/issues/88) cierra la evidencia: reúne el alcance entregado por [#86](https://github.com/reyduar/Vaqcrow/issues/86), sus pruebas determinísticas de [#87](https://github.com/reyduar/Vaqcrow/issues/87), las rutas de implementación y la reproducción local actual. La implementación llegó por PR [#341](https://github.com/reyduar/Vaqcrow/pull/341), merge local `192b5c1`; las pruebas por PR [#342](https://github.com/reyduar/Vaqcrow/pull/342), merge local `e81e8e8`.

> [!info] Alcance de esta unidad
> El motor es puro y framework-free: vive en `@vaqcrow/domain` y todavía **no está cableado** a ninguna ruta Fastify, tabla Supabase, transacción Stellar/Horizon ni llamada LLM. Esta evidencia documenta el cálculo, no su distribución.

## 2. Cómo leer esta evidencia

- **Hechos verificados:** se derivan de los commits locales, archivos versionados y comandos de §5 ejecutados el 2026-09-29 sobre `e81e8e8`, antes de modificar este documento.
- **Hechos simulados de la demo:** la regla y la tasa son fijas de la demo (`RS-2026-01`, 450 bps = 4,50 %), no un contrato real negociado. Los montos usados en las pruebas son valores de diseño, no ventas reales.
- **Trabajo futuro:** se formula como futuro y no como capacidad entregada. El reemplazo de producción del motor es un motor contractual revisado por legal/contabilidad según [[docs/planning/DEMO|DEMO.md]].
- **Reproducción local:** los comandos no requieren Supabase, Stellar Testnet, Horizon, proveedor LLM, credenciales ni datos sensibles. `pnpm run verify` usa sus suites determinísticas; no incluye `test:integration`.

## 3. Implementación trazable

| Límite entregado | Ruta verificable | Hecho comprobado |
|---|---|---|
| Motor determinístico | `packages/domain/src/revenue-share.ts` | Versión `RS-2026-01`; tasa entera en basis points (450 bps = 4,50 %); redondeo explícito y nombrado (`floor` por defecto, `half_up`); dinero en `bigint` sin punto flotante; el resultado es un union sanitizado y nada lanza. |
| Superficie pública del dominio | `packages/domain/src/index.ts` | Re-exporta solo los símbolos públicos del motor (funciones, regla demo, arrays de vocabulario y tipos); no agrega lógica propia. |
| Matriz determinística | `packages/domain/src/revenue-share.test.ts` | 60 pruebas focalizadas que cubren constantes y regla demo, elegibilidad, obligación y redondeo, asignaciones balanceadas, rutas de error sanitizadas, superficie de tipos y la matriz de frontera/validación de #87. |
| Elegibilidad dura y determinística | `packages/domain/src/revenue-share.ts` (`collectPeriods`) | Solo un período `reported` con monto no nulo se factura; `missing` se excluye con motivo `missing_data`; `anomalous` (etiquetado "Requiere revisión" en la demo) se excluye con motivo `requires_review`. Los períodos excluidos se devuelven con su motivo, nunca se descartan, y se preserva el orden de entrada. |
| Asignaciones balanceadas | `packages/domain/src/revenue-share.ts` (`buildAllocations`) | Reparto proporcional entero con residual por mayor resto (empates resueltos por orden de contribuyente); la suma de asignaciones iguala exactamente la obligación. |
| Rutas de error sanitizadas | `packages/domain/src/revenue-share.ts` | Códigos `invalid_rule`, `invalid_period`, `invalid_contributor`, `invalid_obligation` y `no_contributors`; `{ ok: false, error }` sin `message`/`details` y sin excepciones. |
| Endurecimiento de #87 | `packages/domain/src/revenue-share.ts` | `invalid_obligation` para una obligación negativa o no `bigint` (chequeada antes de `no_contributors`); un monto `reported` negativo o no `bigint` se rechaza como `invalid_period`; los arrays de vocabulario exportados quedan congelados en runtime (`Object.freeze`). |
| Frontera de dependencias | `.dependency-cruiser.cjs` | La regla `domain-stays-framework-free` prohíbe que `packages/domain/src` (código de producción, sin `*.test.ts`) importe cualquier dependencia npm; se verifica en `pnpm run boundaries`. |

Los commits locales de la implementación son `845af3e` (motor y pruebas, #86), con su registro ODD `b57e99e`; y `68f4ff5` (matriz de frontera/validación, #87), con su registro `4e9205d`.

> [!important] Límite del motor
> El motor calcula una obligación a partir de entradas provistas; no obtiene ventas, no persiste nada y no mueve fondos. La regla y la tasa son de la demo y no reemplazan una revisión legal o contable.

## 4. Cobertura determinística

Las 60 pruebas de `revenue-share.test.ts` demuestran, sin dependencias externas:

- **Constantes y regla demo:** la versión canónica es `RS-2026-01`; la regla demo queda congelada como `450` bps con redondeo `floor`; los arrays de vocabulario exponen `["floor", "half_up"]` y `["reported", "missing", "anomalous"]`.
- **Elegibilidad:** solo `reported` con monto no nulo se factura; `missing` y `anomalous` se excluyen con su motivo explícito y se devuelven en la obligación.
- **Obligación y redondeo:** la tasa se aplica **una sola vez** sobre el agregado de ventas elegibles, nunca por período, para que el resultado no derive entre períodos.
- **Asignaciones balanceadas:** el reparto proporcional entero con residual por mayor resto suma siempre la obligación exacta, incluida la asignación a un único contribuyente y los casos donde la obligación es menor que la cantidad de contribuyentes.
- **Rutas de error:** cada entrada inválida produce exactamente su código sanitizado, sin campos extra.
- **Matriz #87:** pruebas de obligación negativa/no `bigint`, ventas `reported` negativas/no `bigint`, arrays exportados congelados, invariante de total balanceado y determinismo sobre una matriz fija, y el límite exacto de resto `.5` (floor `0` / half_up `1`).

El ejemplo de diseño fijado por las pruebas es `3_745_800n × 450 bps floor = 168_561n` (en la presentación de la demo, ARS 168.561,00): con 4,50 % el redondeo `floor` trunca el agregado, y el redondeo se aplica una sola vez. Las pruebas también fijan un literal grande (`405_323_966_463_344n`) verificado de forma independiente del motor, y un caso donde 200 unidades × 450 bps dan `9` (y no `8`, que sería el resultado de redondear cada período por separado).

## 5. Resultados de verificación observados

Reproducido localmente el 2026-09-29 sobre `e81e8e8` antes de modificar este documento:

```sh
$ pnpm --filter @vaqcrow/domain exec vitest run src/revenue-share.test.ts

 ✓ src/revenue-share.test.ts (60 tests) 9ms

 Test Files  1 passed (1)
      Tests  60 passed (60)
   Duration  639ms
```

```sh
$ pnpm --filter @vaqcrow/domain test

 ✓ src/application-review.test.ts (60 tests) 5ms
 ✓ src/revenue-share.test.ts (60 tests) 9ms

 Test Files  2 passed (2)
      Tests  120 passed (120)
   Duration  362ms
```

```sh
$ pnpm run verify

Tasks:    5 successful, 5 total   # lint
Tasks:    8 successful, 8 total   # typecheck
Tasks:    8 successful, 8 total   # workspace test
Tasks:    5 successful, 5 total   # build
✔ no dependency violations found (470 modules, 1411 dependencies cruised)
Test Files  9 passed (9)
     Tests  93 passed (93)         # test:boundaries
```

El comando compuesto terminó con **exit 0**. Las tareas de `turbo` se sirvieron desde caché de la misma revisión (`>>> FULL TURBO`), y sus recuentos coinciden con los comandos focalizados ejecutados directamente arriba. La suite completa informó además, por paquete: contratos 12 archivos/344 tests, dominio 2/120, IA 5/107, web 101/708 y API 42/779. El único warning de lint fue preexistente: `apps/web/src/infrastructure/http/fetch-http-client.ts:8`, `_request` sin usar (`@typescript-eslint/no-unused-vars`); hubo 0 errores. Las líneas `stderr` de repositorios Supabase durante los tests son fixtures de sanitización de errores, no una conexión de integración ni un fallo del gate.

## 6. Mapeo de criterios de aceptación

| Criterio (verbatim, issue #88) | Resultado |
|---|---|
| "Evidence identifies Feature #27, verification commands, and observed results." | ✅ PASS — §1 identifica la Feature #27 y sus Tasks #86/#87/#88, con sus PRs y merges locales; §5 contiene los tres comandos ejecutados y sus resultados observados, incluido `pnpm run verify` con exit 0. |
| "Evidence is traceable to implementation and focused tests." | ✅ PASS — §3 vincula motor, superficie pública, matriz determinística, elegibilidad, asignaciones, rutas de error, endurecimiento de #87 y frontera de dependencias con sus rutas versionadas; §4 y §5 enlazan esas rutas con las suites focalizadas 1 archivo/60 tests y 2 archivos/120 tests. |
| "Sensitive data and unsupported production claims are excluded." | ✅ PASS — el documento no contiene secretos, tokens, semillas, PII ni XDR; §§1–2 y §7 delimitan el motor como cálculo puro no cableado, la regla/tasa como fijas de la demo y la revisión legal/contable como reemplazo futuro. |

## 7. Límites conocidos y trabajo futuro

1. **El motor todavía no está cableado.** No existe una ruta Fastify, una tabla Supabase, una transacción Stellar/Horizon ni una llamada LLM que consuma estas funciones. La Task de distribución [#89](https://github.com/reyduar/Vaqcrow/issues/89) bajo la Feature [#28](https://github.com/reyduar/Vaqcrow/issues/28) es quien consumirá el motor. Esta evidencia no afirma integración alguna.
2. **No se mueven fondos.** El cálculo es un valor de dominio; ninguna operación económica, firma, bóveda ni pago se ejecutó en esta unidad.
3. **La regla y la tasa son de la demo.** `RS-2026-01` y 450 bps son fijos de la demostración; el motor contractual revisado por legal/contabilidad permanece como reemplazo de producción según [[docs/planning/DEMO|DEMO.md]].
4. **Endurecimiento de tests opcional, no entregado.** El review de #87 dejó dos sugerencias opcionales para afinar más adelante: `R3-001` (añadir un monto `reported` de exactamente `0n` para probar el borde que la comparación estricta `< 0n` admite) y `R3-002` (reforzar la prueba de determinismo con un intento de mutación). No forman parte del trabajo entregado por #86/#87.

> [!warning] Alcance de la demo
> El cálculo demuestra una interfaz de dominio determinística, no asesoramiento legal, contable ni fiscal, ni una operación financiera en Argentina. La obligación que produce no es ejecutable contractualmente. Vaqcrow continúa siendo una demostración no apta para producción.

## 8. Estado de entrega

Los merges locales `192b5c1` y `e81e8e8` confirman que #86 y #87 están incorporados a la base actual. Esta Task #88 aporta el documento de cierre y conserva su rama propuesta hasta que el flujo de revisión y merge ocurra; no se presenta como entregada por este documento. La frontera de rollback de esta unidad es exclusivamente documental: `docs/planning/revenue-share-calculation-evidence.md`, el ajuste de roadmap de #86/#87 y `odd/tasks/document-evidence-for-deterministic-revenue-share-calculation.md`.

### Próximo paso

Revisar y mergear la unidad documental de #88. Solo después podrá cerrarse la Feature #27 y habilitarse el trabajo de distribución de [[docs/planning/DEMO|DEMO.md]] (#28 y su Task #89); ese cierre no se afirma aquí como realizado.
