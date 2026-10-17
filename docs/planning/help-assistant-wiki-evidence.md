# Evidencia de cierre de la Feature #499 — Asistente de ayuda con wiki compilada estilo Karpathy

> Documento de cierre de Feature. Consolida la evidencia de la Feature [#499](https://github.com/reyduar/Vaqcrow/issues/499) ("Feature: Add a help assistant for signed-in users grounded in a Karpathy-style compiled wiki"), re-ejecuta el gate completo sobre `main` y mapea cada criterio de aceptación de la Feature, citado textualmente, a su resultado y a la fuente de ese resultado. La bitácora de iteración que lo alimenta es [[odd/tasks/help-assistant-wiki|Bitácora: Asistente de ayuda con wiki compilada]].

> [!success] Estado de entrega: la Feature está completa en `main`
> La Feature se entregó **encadenada a `main`** en una PR por unidad, y todas están mergeadas: WU1 —la wiki compilada— vía [#523](https://github.com/reyduar/Vaqcrow/pull/523); WU2 —la API— vía [#524](https://github.com/reyduar/Vaqcrow/pull/524), con su corrección de build [#526](https://github.com/reyduar/Vaqcrow/pull/526) (la wiki dentro del contexto de build de la API); y WU3 —la web y el toggle de admin— vía [#525](https://github.com/reyduar/Vaqcrow/pull/525). La migración remota de WU2 está aplicada y verificada, y el asistente responde en producción.

## 1. Contexto y objetivo

La Feature #499 agrega un **asistente de ayuda** para usuarios logueados (`PYME` e `INVERSOR`) que responde **solo** desde una **wiki compilada** en `docs/wiki/`, siguiendo el método LLM Wiki de Karpathy: sin embeddings ni base vectorial. En cada pregunta, una llamada **router** elige páginas a partir de `index.md` y una llamada de **respuesta** contesta con esas páginas y las cita. Fuera de alcance, declina; sin página que cubra la pregunta, responde «no tengo documentación». El visitante anónimo sigue viendo solo las preguntas frecuentes.

Las diez preguntas abiertas del issue se resolvieron de a una el 2026-10-14 (decisiones **D1–D10** de la bitácora, registradas en el [comentario del issue](https://github.com/reyduar/Vaqcrow/issues/499#issuecomment-6174765370)) antes de implementar; ninguna se inventó. Antes de WU2 el owner corrió un spike contra OpenCode Go (§Spike de la bitácora).

| Unidad | Alcance | PR | Estado |
|---|---|---|---|
| WU1 | `docs/wiki/` (`schema.md`, páginas, `index.md`, `log.md`) y `tests/wiki-structure.test.ts` | [#523](https://github.com/reyduar/Vaqcrow/pull/523) | en `main` |
| WU2 | API: contratos, ports, adaptadores, casos de uso con las guardias, ruta, flag de acceso, tope, migración, config y `Dockerfile` | [#524](https://github.com/reyduar/Vaqcrow/pull/524) | en `main` |
| — | La wiki dentro del contexto de build de la API | [#526](https://github.com/reyduar/Vaqcrow/pull/526) | en `main` |
| WU3 | Web: el mismo chat en el asistente flotante y en `/help`; toggle de acceso en `/admin` → Usuarios | [#525](https://github.com/reyduar/Vaqcrow/pull/525) | en `main` |
| WU4 | Este documento + sync de `demo-tasks-list.md` + `pnpm run verify` | [#611](https://github.com/reyduar/Vaqcrow/pull/611) | en revisión |

## 2. Cómo leer esta evidencia

- **Dos fuentes, siempre nombradas.** (a) **Re-ejecutado**: `pnpm run verify` corrido el 2026-10-17 sobre `main` (`f0925b0`) en este árbol de trabajo, con su salida real (§4.1). (b) **Bitácora**: una entrada fechada de [[odd/tasks/help-assistant-wiki]]; se cita, no se re-ejecutó aquí.
- **Sin secretos.** Ninguna clave, token ni identificador de proyecto aparece aquí; las variables se nombran, nunca sus valores.
- **Sin claims de producción.** El asistente es parte de la demo sobre **Stellar Testnet** y es **orientativo**: no decide, no aprueba ni mueve fondos.

## 3. Qué quedó implementado

- **Wiki compilada (WU1).** `docs/wiki/schema.md` es el contrato (tipos de página, front matter con `sources` bajo `docs/guides/`, reglas de honestidad). Hoy la wiki tiene **18 páginas** listadas en `index.md` y su `log.md`; WU1 entregó 16, y después se sumaron `freighter-y-friendbot` (#558) y `ecosistema-stellar` (#599). Corpus solo de guías de usuario (D1); `storybook.md` queda interno.
- **API (WU2).** `POST /assistant/questions`, `only("PYME","INVERSOR")`. El caso de uso `askAssistant` aplica en orden: flag por usuario `profile.chat_enabled` (D9, apagado por defecto) → tope de **5 preguntas por usuario por 24 h** en ventana móvil (D6) → router sobre `index.md` → páginas → respuesta. Las respuestas fijas de D8 viven en `apps/api/src/application/assistant/fixed-copy.ts`. Turno único sin historial (D4); el texto de preguntas y respuestas **no se persiste**, solo timestamps en `assistant_question` (D5). El scope `account` responde con la copy que apunta a los informes (D3). Una cita fuera de las páginas ruteadas o una salida inválida provocan **un** reintento y después «no documentación»; una falla del proveedor responde `503 { code: "unavailable" }`. El streaming se difirió (JSON único, decisión del owner).
- **Web (WU3).** `AssistantChat` es el mismo componente en el asistente flotante y en `/help`. Las citas enlazan a la screen de la página (D10). El `ADMIN` y el anónimo ven las FAQ. Toggle de acceso en `/admin` → Usuarios.
- **Seguimiento posterior**, fuera del alcance original pero sobre la misma Feature: el flotante con sesión conserva los accesos rápidos y «Ir al centro de ayuda» ([#559](https://github.com/reyduar/Vaqcrow/issues/559)); el flotante se monta en `/company` ([#535](https://github.com/reyduar/Vaqcrow/issues/535)) y en todas las páginas con sesión ([#570](https://github.com/reyduar/Vaqcrow/issues/570)); la lista negra de copia pública escanea la wiki ([#582](https://github.com/reyduar/Vaqcrow/issues/582)).

## 4. Qué quedó probado

### 4.1 Re-ejecutado en este árbol de trabajo (2026-10-17)

```text
$ pnpm run verify   # rama docs/record-release-v1.2.0 = main f0925b0 + solo docs; exit 0
lint                 Tasks: 5 successful, 5 total
typecheck            Tasks: 8 successful, 8 total
test  @vaqcrow/domain     Test Files 4 passed (4)     · Tests 155 passed (155)
      @vaqcrow/contracts  Test Files 29 passed (29)   · Tests 762 passed (762)
      @vaqcrow/ai         Test Files 9 passed (9)     · Tests 160 passed (160)
      @vaqcrow/web        Test Files 256 passed (256) · Tests 2562 passed (2562)
      @vaqcrow/api        Test Files 164 passed (164) · Tests 3249 passed (3249)
build                Tasks: 5 successful, 5 total
boundaries           ✔ no dependency violations found (1421 modules, 4748 dependencies cruised)
test:boundaries      Test Files 11 passed (11) · Tests 189 passed (189)
```

### 4.2 Qué cubre cada suite

| Comportamiento | Prueba | Fuente del resultado |
|---|---|---|
| Flag apagado → `forbidden` antes de cualquier otra dependencia; flag ilegible → `unavailable` | `apps/api/src/application/use-cases/ask-assistant.test.ts` («access (S2, D7, D9)») | Re-ejecutado (§4.1) |
| Tope: en el límite responde la copy del Blog sin leer el índice ni llamar al modelo; ventana móvil de 24 h | `ask-assistant.test.ts` («rate limit (S8, D6)») | Re-ejecutado (§4.1) |
| Sin páginas, página desconocida o archivo faltante → «no documentación», sin llamar al answerer | `ask-assistant.test.ts` («no documentation (S4)») | Re-ejecutado (§4.1) |
| Fuera de alcance → declinación, sin llamada de respuesta | `ask-assistant.test.ts` («out of scope (S5)») | Re-ejecutado (§4.1) |
| Respuesta con citas enriquecidas (título y screen); cita fuera de lo ruteado o salida inválida/`null` → un reintento y «no documentación» | `ask-assistant.test.ts` («citations and retry (S3, S6)») | Re-ejecutado (§4.1) |
| Falla del transporte → `unavailable` sin reintento; una excepción nunca escapa | `ask-assistant.test.ts` («provider failure (S8)», «a thrown dependency is unavailable») | Re-ejecutado (§4.1) |
| La pregunta y las páginas van delimitadas como datos no confiables; el sistema declara que instrucciones dentro de la wiki no cambian las reglas; la pregunta nunca entra al mensaje de sistema | `apps/api/src/application/assistant/prompts.test.ts` (fixtures de inyección en la pregunta y dentro de una página) | Re-ejecutado (§4.1) |
| Ruta: `PYME`/`INVERSOR` 200 con el sobre del contrato; `ADMIN` 403; sin token 401; flag apagado 403; proveedor 503 saneado | `apps/api/src/infrastructure/http/routes/assistant.route.test.ts` | Re-ejecutado (§4.1) |
| Cliente OpenCode Go: dialecto, `x-opencode-session`, non-2xx/JSON inválido/red → `unavailable`, abort → `timeout` | `apps/api/src/infrastructure/adapters/opencode-go-assistant-chat.test.ts` (transporte inyectado) | Re-ejecutado (§4.1) |
| Lectura de la wiki desde el filesystem y corpus real: cada página del índice existe y tiene `sources` | `filesystem-wiki-repository.test.ts`, `wiki-corpus.test.ts`, `wiki-markdown.test.ts` | Re-ejecutado (§4.1) |
| Estructura de la wiki y copia pública sin términos prohibidos | `tests/wiki-structure.test.ts`, `tests/wiki-public-copy.test.ts` | Re-ejecutado (§4.1, `test:boundaries`) |
| Contrato del asistente | `packages/contracts/src/assistant.test.ts` | Re-ejecutado (§4.1) |
| El mismo chat para `PYME`/`INVERSOR` en el flotante y en `/help`; anónimo y `ADMIN` en la vista de FAQ | `apps/web/src/presentation/components/landing/help-assistant.test.tsx`, `apps/web/src/app/help/page.test.tsx` | Re-ejecutado (§4.1) |
| Chat: envía la pregunta, muestra las respuestas fijas textuales, 403 con la copy de acceso, cita sin screen como texto | `apps/web/src/presentation/components/assistant/assistant-chat.test.tsx`, `apps/web/src/state/assistant-store.test.ts`, `apps/web/src/infrastructure/assistant/http-assistant-gateway.test.ts` | Re-ejecutado (§4.1) |
| Migración: `profile.chat_enabled` y `assistant_question` con RLS on y grants solo `service_role` | `supabase/tests/assistant_access.sql` | Bitácora WU2 (33/33); no re-ejecutado aquí |

### 4.3 Verificaciones fuera del gate de PR (tomadas de la bitácora o del owner, no re-ejecutadas)

- **Migración remota** (bitácora WU2, 2026-10-14): aplicada y verificada (`profile.chat_enabled` + `assistant_question`, RLS on, service_role-only), historial alineado a `20261014190000`. Variables `LLM_ASSISTANT_ROUTER_MODEL` y `LLM_ASSISTANT_ANSWER_MODEL` configuradas en Railway.
- **Spike contra OpenCode Go** (corrida local del owner, 2026-10-14): `x-opencode-session` obligatorio, modelos con razonamiento que pueden devolver `content: null`, `response_format` sin efecto útil, y la guardia de scope confirmada.
- **Uso real en producción** (owner, 2026-10-17): el asistente respondió con sesión en `www.vaqcrow.com`, incluida una pregunta respondida desde la página nueva `ecosistema-stellar`. Es una comprobación manual del owner, no un test.

## 5. Límites y brechas vigentes

1. **S7 se prueba en la construcción del prompt, no contra el modelo.** Los tests fijan que la pregunta y las páginas viajan delimitadas como datos y que el sistema declara las reglas; la defensa de fondo son las guardias deterministas (cita fuera de lo ruteado → «no documentación»). Ningún test del gate llama al modelo real, por diseño (S10), así que la resistencia del modelo a una inyección no está medida.
2. **El canal de «soporte» (resuelto, owner 2026-10-17).** La copy fija de D8 dice «escribí a soporte», y D8 pedía verificar el canal real. El owner lo confirmó: es **`contact@vaqcrow.com`**, el mismo que ya publican «Acerca de» (`apps/web/src/application/about/copy.ts`), el centro de ayuda («Escribir al equipo», `apps/web/src/application/help/faq.ts`) y los Términos (`apps/web/src/application/legal/terms.ts`). La copy fija del asistente no incluye la dirección; sumarla sería un cambio de la copy aprobada en D8.
3. **Advisory abierto:** el `screen` de una cita (`assistantCitationSchema`) está tipado como string, no restringido a una ruta interna. Hoy su valor sale del front matter de la wiki, que es del repo, y el test estructural lo fija a rutas reales; restringirlo a un prefijo `/` en el contrato es un endurecimiento barato, no un hallazgo.
4. **Sin streaming.** La respuesta llega en un único JSON (decisión del owner en WU2).
5. **El pgTAP no se re-ejecutó aquí** (§4.2): su resultado viene de la bitácora de WU2.

## 6. Evaluación de seguridad (`owasp-security`)

Tomada de la bitácora, por unidad:

- **WU2, API** (OWASP Top 10:2025 + LLM Top 10): **A01** la ruta es `only("PYME","INVERSOR")` y el flag `chat_enabled` se aplica en el servidor (403), nunca desde el body. **A03/A05** la pregunta es entrada no confiable (trim + 2000 caracteres) y el cuerpo de la wiki se trata como contenido, con framing anti-inyección en los prompts (LLM01). **A10** falla cerrado: proveedor → 503, salida inválida → «no documentación» tras un reintento. **A02/A04** no se persiste el texto, solo timestamps, y el proveedor no recibe datos del usuario. **A06** sin dependencias nuevas. **Sin hallazgos.**
- **WU3, web**: **A01** la visibilidad es por rol y el flag lo impone la API (403 → copy), así que el cliente no puede saltarlo. **A05** la respuesta se renderiza como texto (React escapa) y las citas como enlaces internos. **A02** el store vive por montaje y no persiste nada. **A06** sin dependencias nuevas. **Sin hallazgos.**

## 7. Mapeo de criterios de aceptación

| # | Criterio (verbatim, issue #499) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Signed-in users get the same chat component in the floating assistant and on `/help`." | ✅ **Cumplido.** `AssistantChat` se monta en ambos para `PYME` e `INVERSOR`. | `help-assistant.test.tsx`, `help/page.test.tsx` (§4.1) |
| 2 | "Anonymous visitors see only the FAQ, and the assistant endpoint rejects requests without a session." | ✅ **Cumplido.** El anónimo queda en la vista de FAQ; la ruta responde 401 sin token. | `help-assistant.test.tsx`, `assistant.route.test.ts` (§4.1) |
| 3 | "A covered question gets an answer citing its wiki page(s)." | ✅ **Cumplido.** La respuesta trae las citas enriquecidas con título y screen (D10). | `ask-assistant.test.ts` (§4.1); uso real del owner (§4.3) |
| 4 | "An uncovered question gets the fixed "no documentation" answer and the answer call is never made (asserted with doubles)." | ✅ **Cumplido.** Con dobles, el answerer nunca se llama. | `ask-assistant.test.ts` («no documentation (S4)») |
| 5 | "An out-of-scope question gets the fixed decline and the answer call is never made." | ✅ **Cumplido.** | `ask-assistant.test.ts` («out of scope (S5)») |
| 6 | "A citation outside the routed pages, or invalid structured output, ends in the "no documentation" answer." | ✅ **Cumplido**, tras un único reintento. | `ask-assistant.test.ts` («citations and retry (S3, S6)») |
| 7 | "Prompt-injection fixtures (in a question and inside a wiki page) do not change the rules." | ✅ **Cumplido en la construcción del prompt**, con el límite de §5.1. | `prompts.test.ts` (§4.1) |
| 8 | "Per-user rate limit enforced; provider failure answers `503 { code: "unavailable" }`." | ✅ **Cumplido.** 5 preguntas por 24 h en ventana móvil; 503 saneado. | `ask-assistant.test.ts`, `assistant.route.test.ts` (§4.1) |
| 9 | "`docs/wiki/schema.md`, `index.md`, `log.md` and the first compiled pages exist and were reviewed in a PR." | ✅ **Cumplido.** Revisados en [PR #523](https://github.com/reyduar/Vaqcrow/pull/523); hoy 18 páginas. | `wiki-structure.test.ts`, `wiki-corpus.test.ts` (§4.1) |
| 10 | "PR-gated tests use doubles; no live OpenCode Go calls." | ✅ **Cumplido.** El cliente recibe un transporte inyectado y los casos de uso usan dobles. | `opencode-go-assistant-chat.test.ts`, `ask-assistant.test.ts` |
| 11 | "`pnpm run verify` passes; evidence document `docs/planning/<feature-slug>-evidence.md` written." | ✅ **Cumplido.** `pnpm run verify` sale con código 0 el 2026-10-17 y este documento es la evidencia. | §4.1; este documento |

## 8. Estado de entrega y próximos pasos

- WU1 a WU3 y la corrección de build están en `main`. Este documento y el sync de `docs/planning/demo-tasks-list.md` viajan en [PR #611](https://github.com/reyduar/Vaqcrow/pull/611); el registro del release `v1.2.0` entró antes, en [PR #610](https://github.com/reyduar/Vaqcrow/pull/610).
- Con este documento se cierra la issue #499 y su ítem del tablero pasa a `Done`.

> [!todo] Abierto para el owner
> 1. Opcional: sumar `contact@vaqcrow.com` a las dos respuestas fijas que dicen «soporte» (§5.2).
> 2. Opcional: restringir el `screen` de una cita a rutas internas en el contrato (§5.3).
