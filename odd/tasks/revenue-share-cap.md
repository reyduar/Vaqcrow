# #580 — Tope del revenue share a 1,5× por aporte

Objetivo: la obligación de revenue share termina para cada inversor cuando lo distribuido llega a 1,5 veces lo que aportó; la PyME deja de pagar cuando todos llegan al tope y la copia declara el tope, el fin y el vencimiento. Issue: [#580](https://github.com/reyduar/Vaqcrow/issues/580). Rama: `Vaqcrow#580_Feat_Cap_the_revenue_share_at_1_5x_what_each_investor_contributed` (base `8319722`). Entrega: `ask-on-risk`. Runner: `pnpm run verify`; dominio con `pnpm --filter @vaqcrow/domain test`; copia con el denylist y el lint de corpus.

## Specs

**S1 — Decisión del owner (2026-10-16, verbatim).** «pero decime quien firmaria una regla tan estupida de que sea sin fin? obvio que deberia tener un tope, osea ese porcentaje de la ventas es hasta cubrir la inversion y con ganacias, definime bien esto, como normalmente en el mundo de finanzas se aplica». Base elegida, verbatim de la opción aceptada: «1,5× sobre lo que aportó cada inversor».

**S2 — Estructura de mercado verificada (2026-10-16, con fuentes).** El Revenue-Based Financing tiene tres números: monto adelantado, porcentaje de ingresos (típicamente 2–10 % mensual) y **tope** como múltiplo del adelanto (1,2×–3×, lo más común 1,5×–2×), más un **vencimiento** (3–5 años) tras el cual se debe el saldo del tope. Fuentes: Lighter Capital «The Rise of Revenue-Based Financing»; Innovative Finance Playbook «Revenue Based Loans»; Catalyze «The State of RBF & CDFIs»; Issuer glossary; Founderpath citando NerdWallet y Shopify. Dos consecuencias que el mercado declara y la copia no debe esconder: el tope **es el precio** (no una tasa), así que vender más rápido cobra lo mismo antes y **sube el costo anual**; y el **upside del inversor queda topeado**, que es lo que impide que sea capital.

**S3 — Fórmulas y algoritmo (definición de esta iteración).** Con `c_i` aporte del inversor `i`, `V` ventas declaradas y `P = floor(4,5 % × V)`:

1. `tope_i = floor(c_i × capNumerator / capDenominator)`, con `capNumerator = 3`, `capDenominator = 2` → exactamente 1,5× sin floats.
2. `restante_i = max(0, tope_i − ya_distribuido_i)`.
3. `aRepartir = min(P, Σ restante_i)`.
4. Reparto **solo** entre los que tienen `restante_i > 0`, proporcional a `c_i`, con el residuo por mayor resto (la mecánica existente).
5. **Truncado**: `pago_i = min(reparto_i, restante_i)`.
6. **Redistribución del sobrante**: lo que el truncado deja sin asignar se reparte de nuevo, con el mismo criterio, entre los que todavía tienen capacidad. El bucle termina cuando no queda sobrante o nadie tiene capacidad: cada vuelta o asigna todo o agota la capacidad de al menos uno, así que está acotado por la cantidad de inversores y es determinístico.
7. **Estado terminal**: cuando `Σ restante_i = 0`, el acuerdo terminó. El resultado lo declara explícitamente en lugar de repetir una distribución.

**Invariante nuevo (reemplaza al viejo).** Hoy el dominio afirma `totalAllocated == obligation` (`revenue-share.ts:377-381`). Con tope por inversor eso deja de valer: el reparto puede quedar por debajo del pozo. El invariante pasa a ser `totalAllocated == min(obligation, Σ restante_i)`, es decir `<=` en general y `==` exactamente cuando ningún tope trunca. La aserción se **reescribe, no se borra**.

**S4 — El acumulador se deriva; no se agrega estado.** Verificado: `SupabaseRevenueShareDistributionRepository` persiste una fila por destinatario con `(accountId, amountStroops)` y las lee en cada consulta (`SELECT_WITH_RECIPIENTS`, `apps/api/src/infrastructure/adapters/supabase-revenue-share-distribution-repository.ts`). Entonces `ya_distribuido_i` = suma de `amountStroops` de las distribuciones **confirmadas** de esa campaña cuyo destinatario es el inversor `i`. Sin tabla, sin columna, sin migración, y con la fuente correcta: lo que se pagó, no lo que se pensaba pagar. Sólo cuentan las `confirmed`: una `submitted` todavía no movió dinero y una `failed` no cuenta. Límite honesto: el índice parcial único (campaña + período, salvo `failed`) serializa los períodos, así que no hay dos distribuciones activas del mismo período; preparar dos períodos distintos en simultáneo podría sobrepasar un tope — queda documentado, no resuelto.

**S5 — Trade-off honesto que la copia debe declarar.** Cuanto más rápido vende la PyME, antes alcanza el tope y **más caro le sale el dinero por año**. Y el retorno del inversor **se corta en 1,5×** de lo que aportó: no es una tasa, no es una proyección y no es algo asegurado.

**S6 — Restricciones del repo.** La versión de la regla cambia (`RS-2026-01` → nueva) y `REVENUE_SHARE_RULE_VERSION` dice estar «fixed by `docs/design/demo-ui.md`», así que esa cita se actualiza también. La versión ya se desincronizó una vez: #506. La estación de revenue share de «Cómo funciona» es copy dentro de un `##` existente: los encabezados mapean posicionalmente a dos arrays congelados y un test fija la cantidad de estaciones. La página de wiki necesita sus tres registros y pasa el lint de corpus. El vencimiento se **documenta, no se implementa**: la demo no tiene cobranza y forzarlo sería otro producto.

## Tasks

- **T1** | S1,S2 | inline | Bitácora y su espejo en Engram — **hecho**.
- **T2** | S3,S4 | delegated | Dominio: tope por aporte, truncado, redistribución, invariante nuevo, estado terminal y la versión de regla, con tests RED→GREEN — **hecho**. RED 14 fallas/129 pasan → GREEN 148; typecheck limpio; boundaries sin violaciones.
- **T3** | S4 | delegated | API: derivar el acumulador de las distribuciones confirmadas y surfacear el estado terminal — **hecho**. RED 4 fallas/37 pasan → GREEN; API 3244 pasan (164 archivos); `obligation_completed` → 409. El worker frenó primero en el límite de superficies (el padre no había derivado que el tipo de dependencias rompe `revenue-share-distribution-sequence.test.ts`) y no improvisó: el padre corrigió la superficie y decidió la unidad.
- **T4** | S5,S6 | delegated | Copia: las cuatro superficies, la versión citada y el párrafo de dilución de #579 — **hecho** (la última parte del párrafo de #579 queda para el issue, que es donde vive). Incluye retirar la frase que el tope volvió falsa, la tabla nueva del blog y las citas vivas fuera de la superficie original. El worker detectó un typo del padre (`vaqcrow-sobre-stellar.md`) y editó el archivo correcto.
- **T5** | S2,S6 | inline + verifier | Verificación y commits por unidad de trabajo — **hecho**. `pnpm run verify` EXIT=0 en dos corridas (la primera falló por un `no-fallthrough` real que el lint encontró y el padre corrigió). Verificador independiente: **sin blockers**, con grilla exhaustiva + 5.000 casos de fuzz; sus probes quedaron commiteados como `packages/domain/src/revenue-share.cap.test.ts`.

## Log

**L1 (usuario, 2026-10-16, verbatim).** «pero decime quien firmaria una regla tan estupida de que sea sin fin? obvio que deberia tener un tope, osea ese porcentaje de la ventas es hasta cubrir la inversion y con ganacias, definime bien esto, como normalmente en el mundo de finanzas se aplica»

**L2 (usuario, 2026-10-16, decisión, verbatim).** «1,5× sobre lo que aportó cada inversor»

**L3 (hallazgo verificado).** El acumulador no requiere estado nuevo: el repositorio ya persiste una fila por destinatario con su monto, así que `ya_distribuido_i` se deriva del libro de distribuciones confirmadas. Reduce el alcance: sin migración.

**L4 (interacción con #579).** Con el tope por aporte, el pozo es `1,5 × Σaportes` y cada uno cobra `1,5 × c_i`: el retorno por peso es idéntico para todos y **la dilución por sobrefinanciación desaparece**. El párrafo de dilución del cuerpo de #579 queda falso y hay que reescribirlo en la unidad de T4.

**L5 (deuda detectada).** El cuerpo de #580 afirma que el acumulador es estado nuevo. Verificado lo contrario en L3: el issue se corrige cuando se actualice.

**L6 (decisión del owner, 2026-10-16).** «Apilar #580 sobre #579 (recomendado)»: la rama de #580 se rebasó sobre `894f6c5`, así que #579 mergea antes y el PR de #580 queda encadenado. Motivo: el artículo de blog y la sección de wiki que la frase falsa habitaba sólo existían en la rama sin mergear de #579; si #580 mergeaba primero, #579 la reintroducía. El rebase salió **sin conflictos** (7 commits: 4 de #579 + 3 de #580, más el probe del verificador).

**L7 (verificación independiente).** Verificador `gentle-ai-verify` sobre `894f6c5..`: **sin blockers**. Grilla exhaustiva y 5.000 casos de fuzz confirman que el tope se cumple por construcción (`min(tentativa, restante)` en cada pago), que el invariante `totalAllocated == min(obligation, Σrestante)` vale en sus dos ramas, que el acumulador cuenta sólo `confirmed` y une por igualdad exacta de string, y que el fallo de lectura es error, nunca cero. La verificación **no** cubrió: las fuentes externas de S2 (sin red), `test:db` (fallas preexistentes), el límite de períodos concurrentes, e2e ni UI renderizada.

**L8 (advisories del verificador, sin resolver).** (a) Los documentos de `docs/planning/*-evidence.md` conservan descripciones en presente de la regla como `RS-2026-01`: el padre los dejó como registro histórico, y el verificador señala que la regla de alineación de `AGENTS.md` los vuelve obsoletos — es una decisión abierta, no un error. (b) `docs/wiki/revenue-share.md` dice «el acuerdo **sí tiene un total**» donde el blog dice «sí tiene un tope»: «total» es más laxo, aunque la frase siguiente lo acota. (c) `buildCappedAllocations` tiene un `break` defensivo inalcanzable; no es un defecto.

**L9 (deuda del padre).** La delegación de T3 no pidió `lint` entre los comandos de verificación, y el `no-fallthrough` del mapa de estados pasó `test` y `typecheck` sin ser visto: lo encontró `pnpm run verify` recién en la corrida del padre. Lección: pedir siempre el gate completo a los writers, no un subconjunto.

**L10 (cierre del arco, 2026-10-17).** Los cinco PRs (#585, #586, #587, #588, #591, #592) quedaron en `main` = `fd102f1`; cero abiertos. Cerrados: #579 y #580 (Features) y #581, #582, #583, #590 (Tasks). El Epic **#584 se cerró a mano** con 3/3 hijos y un comentario que nombra los residuos. El seed remoto del blog se aplicó y se verificó.

**L11 (residuos de la misma clase).** Quedaron abiertos #589 (una carrera de tests), #593 (las afirmaciones de invariante) y #594 (el heading que el escaneo eximía). Los tres son *un documento que siguió seguro cuando el código dejó de coincidir*.

**L12 (corrección de #593 y #594, 2026-10-17).** En `docs/planning/revenue-share-calculation-evidence.md`: la fila «Asignaciones balanceadas» de §3 y su punto en §4 nombraban `buildAllocations` —función que #580 borró— y afirmaban que «la suma de asignaciones iguala exactamente la obligación». Ahora nombran `buildCappedAllocations` y el invariante real, `totalAllocated == min(obligation, Σ restante_i)`, con la nota de que el total asignado puede quedar **por debajo** de la obligación. Además, **dos afirmaciones más del mismo archivo** decían en presente que el motor «todavía no está cableado» (§1 y §7): falso, `deriveRevenueShareDistribution` lo consume (`apps/api/src/index.ts`), así que pasaron a tiempo pasado y fechadas. Las mediciones de §5 no cambiaron: contadores, hashes y fechas siguen como se registraron. En `docs/wiki/boveda-soroban.md` el heading `## Qué garantiza` pasó a `## Qué reglas ejecuta la bóveda` y la exención se **eliminó** del escaneo: el RED fue el escaneo fallando con `boveda-soroban.md:14 matches /garantiz/i` tras quitar la exención, y el GREEN lo mismo con el heading reescrito y sin exención.

**Próximo paso.** Empujar la rama y abrir el PR que cierra #593 y #594. Queda abierto #589, que es una carrera de tests y no toca documentos.
