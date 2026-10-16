# Bitácora — Asistente de ayuda con wiki compilada estilo Karpathy (#499)

## Objetivo

Feature [#499](https://github.com/reyduar/Vaqcrow/issues/499): un **asistente de ayuda** para usuarios logueados que responde **solo** desde una **wiki compilada** (`docs/wiki/`, método LLM Wiki de Karpathy, sin embeddings) y corre sobre los modelos de OpenCode Go que ya usa la evaluación. Fuera de alcance: declina. Sin página que cubra la pregunta: «no tengo documentación». El visitante anónimo sigue viendo solo las preguntas frecuentes.

## Rama y entrega

- **Base:** `Vaqcrow#499_Feat_Add_a_help_assistant_for_signed_in_users_grounded_in_a_Karpathy_style_compiled_wiki` (unidad 1, ya mergeada).
- **API:** `…-02-api` (off `main` = `266dd34`).
- **Estrategia:** una rama/PR por unidad, desde `main` (misma convención que #498).
- **Runner:** vitest (unit / functional API / componente) + pgTAP para RLS/grants; cierre con `pnpm run verify`.

## Especificaciones

Criterios de aceptación del issue (citados textualmente):

- **S1.** Signed-in users get the same chat component in the floating assistant and on `/help`.
- **S2.** Anonymous visitors see only the FAQ, and the assistant endpoint rejects requests without a session.
- **S3.** A covered question gets an answer citing its wiki page(s).
- **S4.** An uncovered question gets the fixed "no documentation" answer and the answer call is never made (asserted with doubles).
- **S5.** An out-of-scope question gets the fixed decline and the answer call is never made.
- **S6.** A citation outside the routed pages, or invalid structured output, ends in the "no documentation" answer.
- **S7.** Prompt-injection fixtures (in a question and inside a wiki page) do not change the rules.
- **S8.** Per-user rate limit enforced; provider failure answers `503 { code: "unavailable" }`.
- **S9.** `docs/wiki/schema.md`, `index.md`, `log.md` and the first compiled pages exist and were reviewed in a PR.
- **S10.** PR-gated tests use doubles; no live OpenCode Go calls.
- **S11.** `pnpm run verify` passes; evidence document `docs/planning/<feature-slug>-evidence.md` written.

**Decisiones del owner (2026-10-14)** — las 10 preguntas abiertas, registradas en el [issue](https://github.com/reyduar/Vaqcrow/issues/499#issuecomment-6174765370):

- **D1 (corpus).** Solo las guías de usuario de `docs/guides/` (`como-funciona-vaqcrow.md`, `freighter-and-testnet-walkthrough.md`, `blog/`); `storybook.md` queda **interno** (fuera del Blog y de la wiki).
- **D2 (ubicación).** La wiki compilada vive en **`docs/wiki/`**.
- **D3 (contexto personal).** **Solo guías**; nunca datos del usuario. Cuenta → los **Informes**; sin informe → **soporte**.
- **D4 (conversación).** **Turno único**; sin historial.
- **D5 (logging).** **No se guarda el texto** de preguntas ni respuestas; solo timestamps por usuario (por el tope).
- **D6 (tope).** **5 preguntas por usuario por 24 h** (ventana móvil), persistido. Al llegar al tope → **sugerir el Blog**, **sin** mencionar que existe un límite diario.
- **D7 (roles y páginas).** Chat para **`PYME` + `INVERSOR`**, en el asistente flotante y en `/help`; el `ADMIN` no lo ve; el anónimo sigue con FAQ.
- **D8 (copy fija, aprobada).** Fuera de alcance: «Puedo ayudarte solo con Vaqcrow: qué es, cómo funciona y su tecnología. Para otros temas no soy de utilidad.» Sin documentación: «No tengo documentación sobre eso. Podés leer las guías y el Blog, o escribir a soporte.» Cuenta: «La información de tu cuenta está en tus informes. Si no lo encontrás ahí, escribí a soporte.» Tope: «Te sugiero leer los artículos del Blog: ahí cubrimos Vaqcrow con más detalle.» Hint anónimo: «Iniciá sesión para preguntarle al asistente.» (**verificar** el canal real de «soporte»).
- **D9 (acceso, mitigación del riesgo de proveedor).** Un **flag por usuario** (apagado por defecto) con **toggle en `/admin` → Usuarios**; la **API lo hace cumplir**; se combina con los roles de D7. El tope de D6 es el segundo control.
- **D10 (aprendizaje interactivo).** La respuesta **cita la página del wiki + enlaza a la screen**.

**Spike (2026-10-14, corrida local del owner):**

- **Base URL:** `/zen/go/v1` (el default actual) y `/inference/go/v1` **andan los dos**; no se cambia.
- **`x-opencode-session` es obligatorio** para rutear (sin él: `400 MissingSessionID`). La app ya lo manda.
- **Los modelos son reasoners:** `message.reasoning_content` (razonamiento) + `message.content` (respuesta). Si el razonamiento agota `max_tokens`, termina `finish_reason: "length"` con **`content: null`**.
- **`response_format: json_object` se acepta pero no ayuda** → no se usa.
- **Guardia confirmada:** sin índice en el prompt, el modelo devolvió `scope: "out"` con páginas vacías.

## Unidades de trabajo

- [x] **WU1 — Wiki compilada.** `docs/wiki/schema.md` (contrato), 16 páginas por tipo, `index.md`, `log.md` y `tests/wiki-structure.test.ts` (invariantes) — (S9). PR **#523**, mergeado.
- [ ] **WU2 — API.** Contratos, ports (`WikiRepository`, `AssistantRouter`, `AssistantAnswerer`), adaptadores (wiki bundleada en la imagen, cliente OpenCode Go), casos de uso puros con las guardias (fuera de alcance → declinación; sin páginas → «no documentación»; cita fuera → descarta; salida inválida → 1 retry; falla del proveedor → 503), ruta autenticada con el flag de acceso + el tope de 5/24 h, migración (flag + timestamps), config (+ espejo en `scripts/demo/preflight`) y `Dockerfile` que bundlea `docs/wiki/` — (S2, S3, S4, S5, S6, S7, S8, D2–D9).
- [x] **WU3 — Web + admin.** El mismo componente de chat en el asistente flotante y en `/help`; el anónimo solo FAQ; el toggle de acceso en `/admin` → Usuarios — (S1, S2, D7, D9).
- [ ] **WU4 — Evidencia y cierre.** `docs/planning/<feature-slug>-evidence.md`, sync de `docs/planning/demo-tasks-list.md`, `pnpm run verify` — (S11).

## Evaluación de seguridad (`owasp-security`)

Se completa antes de cerrar cada PR. Superficies: **entrada no confiable** (la pregunta) e **inyección de prompt** (en la pregunta y en el contenido de la wiki) — LLM Top 10; **acceso** (flag por usuario + roles) — A01; **DoS/abuso** (tope + flag) — A10; **fuga de datos** (el texto no se guarda; el proveedor no recibe datos del usuario) — A02/A04.

**WU2 — API** (OWASP Top 10:2025): **A01** la ruta es `only("PYME","INVERSOR")` y el flag `chat_enabled` se hace cumplir server-side (403), nunca desde el body; **A03/A05** la pregunta es entrada no confiable (trim + 2000 chars) y el cuerpo de la wiki se trata como contenido, con framing anti-inyección en los prompts (fixtures que cubren inyección en la pregunta y dentro de una página); **A10** falla cerrado (proveedor → 503, salida inválida → «no documentación» tras un retry); **A02/A04** no se persiste el texto (solo timestamps); **A06** sin dependencias nuevas. **Sin hallazgos.**

**WU3 — Web** (OWASP Top 10:2025): **A01** la visibilidad es por rol y el flag lo impone la API (403 → copy), el cliente no puede saltarlo; **A05** la respuesta se renderiza como texto (React escapa) y las citas como enlaces internos; **A02** el store vive por montaje y no persiste nada; **A06** sin dependencias nuevas. **Sin hallazgos.**

## Verificación

**WU1 — Wiki** (2026-10-14, PR #523): `tests/wiki-structure.test.ts` 19/19 (`test:boundaries` 185) · `typecheck:tests`/`lint:tests` OK · `storybook.md` fuera por D1.

**WU2 — API** (2026-10-14, PR #524): `pnpm --filter @vaqcrow/api test` 157 archivos / 3126 tests · `contracts` 749 · pgTAP `assistant_access.sql` 33/33 · `openapi:generate` 57 paths · `typecheck`/`lint`/`boundaries`/`test:boundaries` OK. **Migración remota aplicada y verificada** (`profile.chat_enabled` + `assistant_question`, RLS on, service_role-only), historial alineado a `20261014190000`. Vars `LLM_ASSISTANT_ROUTER_MODEL`/`LLM_ASSISTANT_ANSWER_MODEL` = `glm-5.3-flash` en Railway.

**WU3 — Web + admin** (2026-10-14): `pnpm --filter @vaqcrow/web test` 237 archivos / 2305 tests, re-corrido por el padre · `api` 3127 · `contracts` 750 · `openapi:generate` 57 paths · `typecheck`/`lint`/`boundaries`/`test:boundaries` OK.

**Advisory:** el `screen` de una cita (`assistantCitationSchema`) está tipado como string, no restringido a una ruta interna. Hoy el valor es autoría del repo (front matter de la wiki) y el test estructural lo fija a las rutas reales, así que no es un hallazgo; restringirlo a `/`-prefijo en el contrato es un endurecimiento barato.

## Log

- **L1 (2026-10-14, pedido del owner, verbatim):** «que nos falta para comenzar el #499».
- **L2 (2026-10-14).** Las 10 preguntas abiertas de #499 se respondieron de a una (D1–D10) y quedaron registradas en el issue (comentario `6174765370`). Tablero #499 → **In progress**.
- **L3 (2026-10-14).** **Spike** corrido por el owner (script en el temp, informe `spike-report.json`): ambos base URLs andan, `x-opencode-session` obligatorio, los modelos son reasoners y `content` puede venir `null` si el razonamiento agota `max_tokens`, `response_format` no ayuda. Detalle en §Spike.
- **L4 (2026-10-14).** **WU1 entregada** (commit WU1 + el de las tres pantallas): `docs/wiki/` con `schema.md`, 16 páginas, `index.md`, `log.md` y `tests/wiki-structure.test.ts` (19 tests). Delegado a un writer (backstop de contexto). **PR #523 mergeado** (`266dd34`). Aperturas: `centro-de-ayuda`, `/reports` y las dos guías tienen grounding blando (su copy vive en código); `storybook.md` fuera por D1.
- **L5 (2026-10-14).** **WU2 entregada** (commit `60198f4`, PR #524): API del asistente (endpoint, guardias, flag, tope, toggle de admin, migración, config, Dockerfile). Delegado a un writer. Streaming **diferido** (JSON único, decisión del owner). El router suma el scope `account` (D3). Desvíos por tests ineditables: `parseAssistantModels` en `index.ts`, `AdminChatAccessWriterPort` hermano, helpers espejados de `packages/ai`. Migración remota aplicada; vars en Railway.
- **L6 (2026-10-14).** **WU3 entregada** (rama `…-03-web`): chat compartido en el flotante (landing) y `/help` para `PYME`/`INVERSOR`, anónimo solo FAQ, store por montaje, y el toggle de acceso en `/admin` → Usuarios. Para que el toggle muestre el estado real se extendió `AdminUser` con `chatEnabled` y el lector del API proyecta `chat_enabled` (openapi regenerado). Copy nueva (fuera de D8) para el 403: «El asistente todavía no está habilitado para tu cuenta.» Desvío forzado: `unavailable-admin-users-port.ts` (implementación nula del port extendido). Delegado a un writer.
- **L7 (2026-10-15).** **#559** (Epic #555, segundo test manual del owner): «Cuando un usuario tiene habilitado para usar el chatbot no quiero que elimines el enlace de footer del chat de Ir al centro de ayuda ni tampoco los item de guias de FAQ.» En el flotante, `canChat` reemplazaba todo el cuerpo del panel por `AssistantChat`, así que se perdían los tres accesos rápidos y «Ir al centro de ayuda». Ahora la vista con chat renderiza el chat seguido de los **mismos** `QuickLinks` y `HelpCenterLink` de la vista anónima (una sola fuente). El panel suma `max-h-[calc(100dvh-120px)]` y el cuerpo hace scroll, para que el campo del chat siga alcanzable en un celular. `/help` no se toca: ahí el chat ya se **suma** arriba de las FAQ y de las guías. RED: el test nuevo por rol (`PYME`/`INVERSOR`) falló al no encontrar «¿Qué es el revenue share?»; GREEN 12/12. Inline, sin writer (tarea chica).
