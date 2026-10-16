# #579 — Rechazar el excedente por remanente y explicar el revenue share en lenguaje llano

Objetivo: cerrar la regla de sobrefinanciación (ningún aporte puede exceder lo que falta para la meta) y darle al inversor no experto una explicación del mecanismo de revenue share en la landing, en la wiki del asistente y en el blog. Issue: [#579](https://github.com/reyduar/Vaqcrow/issues/579). Rama: `Vaqcrow#579_Feat_Reject_a_contribution_that_would_exceed_the_campaign_goal` (base `8319722`). Entrega: `ask-on-risk`. Runner: `pnpm run verify`; pgTAP con `pnpm run test:db`; lint de corpus con `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/adapters/wiki-corpus.test.ts`.

## Specs

**S1 — Política de sobrefinanciación (decisión del owner, 2026-10-16).** Cita textual: «rechazamos el excedente por remanente». Alcance, textual: «Sólo API + UI (guardrail)». Ubicación, textual: «Todo dentro de #579». Criterio: ningún aporte puede superar `goal - total`; el rechazo vive en el preflight de la API y en la regla de la UI, **no** en el contrato. Verificado: el contrato transfiere `total` —no `goal`— a la PyME (`contracts/campaign-vault/src/lib.rs:205-214`) y su único límite por aporte es `goal / 10` (`:174-177`). Límite honesto: quien firme directo contra el vault todavía puede sobrefondear, así que la copia pública no puede prometer un tope on-chain.

**S2 — Documentación del mecanismo.** Cita textual: «ademas quiero que incluyas en el issue la actualizacion de documento que se renderiza en la seccion de "Comó funciona" y ademas quiero que crees un articulo para el blog y ademas para el asistente de chatbot en el wiki toda una guia explicando sobre el mecanismo de revenue share de nuestra plataforma».

**S3 — Audiencia.** Citas textuales: «bien disenhada, como para que hasta lo entienda un ninho de 5 anhos» y «recorda que nuestra inversores no son personas que entiendan el mercado como un inversor de alto riesgo».

**S4 — Restricciones del repo (derivadas del código, no pedidas por el owner; son condiciones de aceptación).**
- La wiki es **corpus, no producto** (`docs/wiki/schema.md:5-6`): el asistente redacta, la página tiene que ser precisa y verificable. Frontmatter obligatorio `title` / `type` / `sources` / `updated` (`schema.md:42-56`), cuerpo en español, frases cortas, **sin emojis**, sin promesas de rentabilidad (`:58`), y **toda afirmación rastreable a un `source` de `docs/guides/`** (`:54`).
- Toda página tocada necesita tres registros: línea en `docs/wiki/index.md` (`schema.md:60-70`), entrada en `docs/wiki/log.md` (`:72-82`) y pasar el lint `apps/api/src/infrastructure/adapters/wiki-corpus.test.ts` (huérfanas, `type` válido, cada `sources` existente bajo `docs/guides/`).
- La sección «Cómo funciona» mapea sus `##` **posicionalmente** contra dos arrays congelados (`apps/web/src/application/landing/how-it-works.ts:39-53` y `apps/web/src/presentation/components/landing/how-it-works.tsx:52-66`) y un test fija 11 estaciones: **agregar o reordenar un `##` rompe CI**. La actualización es copy dentro de una estación existente.
- Vocabulario prohibido del test de copy pública, textual: `auditad`, `producción`, `listo para`, `legalidad`, `solvencia`, `garantiz`, `garantía`, `rentabilidad`, `asegur`, `retorno`, `proveedor(es)? de calidad`, `promete|promesa|ganancia` (`apps/web/src/application/about/public-copy-prohibited-terms.test.ts:144-156,174`).
- Ese test **no escanea `docs/wiki/**`** ni `trust/disclosures.ts`: cubre copy de código, `como-funciona-vaqcrow.md` y dos artículos de blog **hardcodeados** (`:96-100`). Un artículo nuevo no se escanea solo; hay que agregar su nombre al test.
- El artículo de blog necesita migración de seed idempotente para `public.blog_post` + pgTAP; el seed se aplica al remoto **recién después** del merge y el redeploy de la API (precedente `supabase/migrations/20261015200000_seed_blog_post_freighter_article.sql:16-18` y `odd/tasks/freighter-friendbot-guide.md`).
- Una regla **no implementada** no puede declararse en copy pública: la frase sobre el rechazo del excedente en `como-funciona-vaqcrow.md` aterriza junto con el código de S1, en la misma unidad de trabajo.

**S5 — Hechos verificados que la copia sí puede afirmar.** El período aplica **4,5 %** (450 bps) sobre las ventas declaradas, con la regla versionada `RS-2026-01` (`packages/domain/src/revenue-share.ts:89-94`). El reparto es **proporcional a lo aportado**, con redondeo *floor* y reparto del residuo por mayor resto (`:241-290`). El cálculo es determinístico y la IA no participa. La PyME **firma la transacción en Freighter**; Vaqcrow no firma ni mueve fondos (`docs/guides/como-funciona-vaqcrow.md:69`). Las ventas de la demo son **sintéticas**.

**Supuestos declarados.** El registro de voz (analogía cotidiana, segunda persona, sin jerga) y el slug del artículo son decisiones de esta iteración, no instrucciones del owner. La estructura exacta de la página de wiki y del artículo se elige siguiendo las páginas existentes como referencia de forma.

## Tasks

- **T1** | S2 | inline | Bitácora de la Feature (`odd/tasks/reject-excess-contribution.md`) y su espejo en Engram — **hecho**.
- **T2** | S2,S3,S4,S5 | delegated | Artículo de blog del mecanismo de revenue share: `docs/guides/blog/revenue-share-explicado.md` («El revenue share de Vaqcrow, explicado en simple»), alta en el test de denylist, `supabase/migrations/20261016180000_seed_blog_post_revenue_share.sql` (posición 51/51) y `supabase/tests/blog_post_revenue_share_seed.sql` — **hecho**. Denylist 21/21; pgTAP 6/6. El padre corrigió la copy: ver L12.
- **T3** | S2,S3,S4,S5 | delegated | Expansión de `docs/wiki/revenue-share.md` en lenguaje llano (analogía del kiosco, glosario, el mes paso a paso), más `index.md` y `log.md` — **hecho**. Lint de corpus 19/19. El padre corrigió la copy: ver L12.
- **T4** | S2,S3,S4 | inline | Copy de la estación «La distribución mensual del revenue share» en `docs/guides/como-funciona-vaqcrow.md` — **pendiente** (aterriza con el código de T5).
- **T5** | S1 | pendiente | Guardrail: preflight de API, regla de UI, disclosure canónica y tests.
- **T6** | S3,S4 | inline | Verificación (lint de corpus, denylist, `pnpm run verify`) y commits por unidad de trabajo — **pendiente**.

## Log

**L1 (usuario, 2026-10-16, verbatim).** «quiero hacerte un par de preguntas sobre algunas reglas de negocio que no se como estan desarrolladas y si no definir los issues correspondientes para corregirlas»

**L2 (usuario, 2026-10-16, verbatim).** «por ejemplo que pasa si para lograr el objetivo del proyecto falta 50 XLM pero un inversionista tiene/quiere aportar 100 XML, que hacemos? que recomendación tenemos en este caso? comparado con otras herramientas?»

**L3 (hallazgo verificado).** Ninguna capa valida el remanente: el contrato acepta cualquier monto dentro del tope por inversor `goal / 10` y al alcanzar la meta transfiere **el total** a la PyME; el preflight de la API valida el mismo tope (`campaign.route.ts:360-389`); la UI sólo valida formato, mínimo de 10 XLM, bóveda y red (`campaign-contribution.ts:88-100`).

**L4 (hallazgo verificado, cierra el pendiente abierto en L3).** La sobrefinanciación **diluye el retorno de todos los inversores**: la obligación es 4,5 % de las ventas declaradas y no depende de lo recaudado, mientras el reparto divide por el total efectivamente aportado (`revenue-share.ts:241-290`; el API exige que la suma de aportes iguale el total, `derive-revenue-share-distribution.ts:191-197`). Cada pago se escala por `goal / total`; la dilución máxima es `1 - 1/1,1 = 9,09 %`.

**L5 (usuario, 2026-10-16, verbatim).** «rechazamos el excedente por remanente»

**L6 (usuario, 2026-10-16, decisión, verbatim).** «Sólo API + UI (guardrail)»

**L7 (usuario, 2026-10-16, verbatim).** «aplica los labels, ademas quiero que incluyas en el issue la actualizacion de documento que se renderiza en la seccion de "Comó funciona" y ademas quiero que crees un articulo para el blog y ademas para el asistente de chatbot en el wiki toda una guia explicando sobre el mecanismo de revenue share de nuestra plataforma, bien disenhada, como para que hasta lo entienda un ninho de 5 anhos, recorda que nuestra inversores no son personas que entiendan el mercado como un inversor de alto riesgo.»

**L8 (usuario, 2026-10-16, decisión, verbatim).** «Todo dentro de #579»

**L9 (hecho).** Labels aplicados en #579: `type:feature`, `area:backend`, `priority:medium` (read-back: estado `OPEN` preservado, sin otros labels). El formulario `backlog.yml` no declara labels, así que la creación fue sin ninguno.

**L10 (hallazgo de paso, no corregido).** `AGENTS.md` afirma que `como-funciona-vaqcrow.md` es la única fuente compartida con el help centre, pero `/help` no la lee: su copy vive en `apps/web/src/application/help/faq.ts`. La única compartición real es la cita desde `docs/wiki/centro-de-ayuda.md`. Documento que contradice el código → candidato a issue propio.

**L11 (decisión de secuencia).** La copia que declara la regla de S1 no puede publicarse antes de que el código exista, así que T4 aterriza junto con T5. La wiki de T3 cita como fuente el artículo de T2, que sí describe el mecanismo ya implementado.

**L12 (hallazgo del padre, corrección de copy).** Las dos entregas delegadas afirmaban que el inversor **recupera lo que puso**: «Al final recuperás lo que prestaste, repartido mes a mes» (blog y wiki), «vuelve el capital más un porcentaje de las ventas» (blog) y «El capital vuelve a medida que el negocio vende» (wiki y blog). Verificado contra el código: el único flujo es `4,5 % × ventas declaradas del mes`, repartido en proporción; **no hay tope, ni monto total, ni fecha de fin, ni contador de capital devuelto** (`packages/domain/src/revenue-share.ts:89-94,241-290`; `derive-revenue-share-distribution.ts:161-197`). Para un lector no experto esas frases dicen «recuperás tu plata», que es la promesa que las reglas de copy del repo existen para evitar. El padre reescribió las dos: se quitó toda implicación de recupero garantizado y se agregó una sección «Qué vuelve, y qué no está fijado» que dice, sin usar el vocabulario prohibido, que la regla no fija un total ni una fecha de fin. Ambas copias siguen en verde.

**L13 (verificación).** `pnpm --filter @vaqcrow/web exec vitest run src/application/about/public-copy-prohibited-terms.test.ts` → 21/21, con el artículo nuevo ya registrado y escaneado. `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/adapters/wiki-corpus.test.ts` → 19/19. `grep` manual del vocabulario prohibido sobre `docs/wiki/revenue-share.md` y el artículo → sin coincidencias (necesario: el denylist **no** escanea `docs/wiki/**`). `pnpm run test:db`: la suite nueva pasa 6/6; el conjunto arrastra 5 fallas preexistentes y ajenas (`investor_report`, `marketplace_campaign`, `marketplace_campaign_detail`, `portfolio`, `pyme_documents_bucket`), ya conocidas en este entorno local.

**L14 (hallazgo de paso, no corregido, de la wiki).** `docs/wiki/index.md:10` (la línea de `boveda-soroban`) contiene el término prohibido «garantiza», y el lint de corpus no escanea la copy de la wiki contra el denylist. Como el asistente **redacta** sus respuestas a partir de esa copy, el término puede llegar al usuario. Candidato a issue propio, junto con L10.

**Próximo paso.** Commitear las unidades de trabajo (blog, wiki, bitácora), ampliar el cuerpo de #579 con el alcance de documentación, y dejar T4/T5 (la copy de la estación de «Cómo funciona» y el guardrail) para la unidad donde aterrice el código de S1.
