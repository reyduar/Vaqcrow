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
- **T2** | S3,S4 | delegated | Dominio: tope por aporte, truncado, redistribución, invariante nuevo, estado terminal y la versión de regla, con tests RED→GREEN — **en curso**.
- **T3** | S4 | pendiente | API: derivar el acumulador de las distribuciones confirmadas y surfacear el estado terminal.
- **T4** | S5,S6 | pendiente | Copia: las cuatro superficies, la versión citada y el párrafo de dilución de #579.
- **T5** | S2,S6 | pendiente | Verificación (`pnpm run verify`, denylist, lint de corpus) y commits por unidad de trabajo.

## Log

**L1 (usuario, 2026-10-16, verbatim).** «pero decime quien firmaria una regla tan estupida de que sea sin fin? obvio que deberia tener un tope, osea ese porcentaje de la ventas es hasta cubrir la inversion y con ganacias, definime bien esto, como normalmente en el mundo de finanzas se aplica»

**L2 (usuario, 2026-10-16, decisión, verbatim).** «1,5× sobre lo que aportó cada inversor»

**L3 (hallazgo verificado).** El acumulador no requiere estado nuevo: el repositorio ya persiste una fila por destinatario con su monto, así que `ya_distribuido_i` se deriva del libro de distribuciones confirmadas. Reduce el alcance: sin migración.

**L4 (interacción con #579).** Con el tope por aporte, el pozo es `1,5 × Σaportes` y cada uno cobra `1,5 × c_i`: el retorno por peso es idéntico para todos y **la dilución por sobrefinanciación desaparece**. El párrafo de dilución del cuerpo de #579 queda falso y hay que reescribirlo en la unidad de T4.

**L5 (deuda detectada).** El cuerpo de #580 afirma que el acumulador es estado nuevo. Verificado lo contrario en L3: el issue se corrige cuando se actualice.

**Próximo paso.** Cerrar T2 (dominio) y seguir con T3 (API).
