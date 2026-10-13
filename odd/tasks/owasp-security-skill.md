# Bitácora — Skill OWASP Top 10 y regla de seguridad en `AGENTS.md`/`CLAUDE.md`

## Objetivo

Technical/Foundation [#502](https://github.com/reyduar/Vaqcrow/issues/502): que el repositorio tenga una skill OWASP Top 10 que los agentes cargan para revisar código nuevo o modificado, y que `AGENTS.md`/`CLAUDE.md` exijan evaluar la seguridad contra ella antes de dar un cambio por terminado.

## Por qué

El owner quiere evitar que Vaqcrow se desarrolle con vulnerabilidades. El proyecto ya carga skills por tecnología vía el registro, pero ninguna cubre seguridad de aplicación, y el trabajo que viene (#498 Blog renderizando Markdown, #499 asistente que mete texto libre en un LLM) amplía la superficie de ataque sobre la auth/RLS, los uploads y el armado de transacciones Stellar que ya existen.

## Rama

- **Rama:** `Vaqcrow#502_Technical_Add_an_OWASP_Top_10_security_skill_and_require_it_in_AGENTS_md_CLAUDE_md` (off `main`).

## Decisión de implementación

**Se escribe una skill propia del proyecto.** El issue pedía, como preferencia, buscar una skill vetada e instalarla+lockearla antes que escribir una desde cero, y registrar la elección. Se buscó con `npx skills find` y se evaluaron los candidatos:

| Candidato | Instalaciones | Veredicto |
| --- | --- | --- |
| `hoodini/ai-agents-skills@owasp-security` | 3K | **Descartada.** Cita la edición **2021** y es una tabla mínima de una línea por categoría. |
| `addyosmani/agent-skills@security-and-hardening` | 58.8K (audits Gen/Socket/Snyk Pass) | **No alcanza.** Buena y auditada, pero genérica: no tiene la estructura OWASP ni el mapeo a este stack. |
| `getsentry/skills@security-review` | 19.8K | No alcanza: review genérica, sin OWASP ni LLM. |
| `usestrix/strix@owasp-top-10-testing` | 9.8K | No aplica: es pentest dinámico, no un checklist de código. |

Ninguna cubre las **ediciones vigentes** (web 2025 + LLM 2026) ni está mapeada a Fastify/Next/Supabase RLS-Storage/Stellar/Freighter/LLM, que son criterios de aceptación del issue. Por eso se escribe una skill propia; la búsqueda y el descarte quedan registrados acá. Es la **primera skill del proyecto que no se instala de una fuente externa** (las 15 anteriores están lockeadas en `skills-lock.json`), así que no tiene una entrada ahí — su registro es el archivo del repo.

**Ediciones fijadas** (verificadas contra `owasp.org`, no contra blogs):

- **OWASP Top 10:2025** (publicada nov-2025, finalizada ene-2026; la próxima ~2028-29). A01 Broken Access Control (absorbe SSRF CWE-918), A02 Security Misconfiguration, A03 Software Supply Chain Failures (nueva), A04 Cryptographic Failures, A05 Injection, A06 Insecure Design, A07 Authentication Failures, A08 Software or Data Integrity Failures, A09 Security Logging & Alerting Failures, A10 Mishandling of Exceptional Conditions (nueva). Fuente: <https://owasp.org/Top10/2025/>.
- **OWASP Top 10 for LLM Applications 2026** (v1.0, 2026-08-03). Se mapean los alcanzables: LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM06 Unbounded Consumption, LLM10 Improper Output Handling; LLM03 Excessive Agency queda marcado como no alcanzable mientras la IA no tenga herramientas. Fuente: <https://genai.owasp.org/llm-top-10/>.

> [!warning] Trampa evitada
> Varios blogs (p. ej. AquilaX) publican un orden incorrecto que conserva `A03 Injection` y `A10 SSRF`. La página oficial de `owasp.org` es la autoritativa y es la que cita la skill.

**Estructura:** `SKILL.md` compacto (Activación, Reglas duras, Compuertas de decisión, Pasos, Contrato de salida, Referencias) siguiendo `docs/skill-style-guide.md`… que **no existe** en el repo, así que se usó la copia embebida `references/skill-style-guide.md` de la skill `skill-creator`. El detalle por categoría vive en dos archivos de referencia locales, no en el cuerpo.

## Unidad de trabajo

- [x] **U1 — La skill.** `.agents/skills/owasp-security/SKILL.md` + `references/owasp-top10-2025-web.md` + `references/owasp-top10-2026-llm.md`. Los skills del proyecto viven en `.agents/skills/` y se exponen con un symlink en `.claude/skills/`; se replicó ese patrón (`ln -s ../../.agents/skills/owasp-security .claude/skills/owasp-security`).
- [x] **U2 — Registro.** `gentle-ai skill-registry refresh --cwd <repo> --force` → 32 skills indexadas; la fila `owasp-security` queda en `.atl/skill-registry.md`. Nota: el registro es un artefacto **local generado** (la propia skill `skill-registry` indica poner `.atl/` en `.gitignore`, el repo lo tiene ignorado y el archivo trackeado lleva el bit `skip-worktree`), así que **no se commitea**; se regenera con el comando de arriba.
- [x] **U3 — Regla en las gemelas.** Nueva sección `### Security review` en `AGENTS.md` y `CLAUDE.md` (byte-idénticas), más la mención de la skill en la lista del apartado `### Skills`.
- [x] **U4 — Dry-run + bitácora.** Revisión de la ruta de subida de documentos contra la skill (abajo).

## Evaluación de seguridad — dry-run sobre `POST/DELETE/GET /storage/uploads`

Ruta elegida: `apps/api/src/infrastructure/http/routes/storage.route.ts`, con `route-policy.ts`, `authorization-hook.ts`, `build-app.ts` (límites multipart), `validateDocumentUpload` y `object-path.ts`.

**Resultado: sin hallazgos reales.** Dos cosas se sospecharon y se descartaron al verificar — que es, justamente, el punto del dry-run:

- **A01 (sospecha inicial, descartada).** El handler `GET /storage/uploads` no repite el chequeo de `request.principal` ni de propiedad. **Descartado:** la autorización es central por tabla de políticas + hook default-deny; `route-policy.ts` declara `"GET /storage/uploads": only("ADMIN")` (y POST/DELETE `only("PYME")`). El handler no lo repite porque el hook ya lo garantiza.
- **A10/DoS (sospecha inicial, descartada).** `validateDocumentUpload` mide el tamaño *después* de `part.toBuffer()`, lo que en teoría bufferiza un archivo enorme antes de rechazarlo. **Descartado:** `build-app.ts` registra `@fastify/multipart` con `limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 1 }`, así que el transporte corta en 10 MB antes de bufferizar.

Lo verificado y correcto, por categoría:

- **A01:** DELETE exige `isOwnedObjectPath(path, principal.userId)` → 403 (el adapter escribe con `service_role`, que saltea RLS). GET es `only("ADMIN")` por diseño (#410, el admin revisa documentos de PyMEs).
- **A05/A08:** `isValidObjectPath` (3 segmentos, charset, sin `..`) + `objectPath === path`; la respuesta fuerza `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store` y un `Content-Type` que sale de la allow-list validada por magic bytes (PDF/JPEG/PNG). SVG no está permitido → sin XSS por tipo.
- **A10:** en POST, si falla la persistencia del descriptor se compensa borrando el objeto y se responde 503 (no queda huérfano ni se responde éxito).

**Observación menor (sin issue):** el `catch` de `GET /storage/uploads` responde 503 sin registrar nada. Es un hueco de observabilidad (A09) de severidad baja y, para el alcance de la demo, no amerita su propio issue; queda anotado acá.

**Hallazgo aparte (fuera de la ruta, sobre este mismo trabajo):** la copia **commiteada** de `.atl/skill-registry.md` (fechada 2026-09-20) contiene rutas absolutas `/Users/arielduarte/...`, que exponen la estructura local del desarrollador en un repo público. Es preexistente y ajeno a #502; se reporta, no se toca acá.

## Verificación

- Estructura de la skill: frontmatter completo y de una línea, secciones en el orden de la guía. Cuerpo de 434 palabras: por encima del objetivo de la guía (180–450 tokens) pero dentro de su máximo recomendado (700), porque las reglas duras y la tabla de decisión son la carga útil; el detalle por categoría vive en `references/`.
- `diff -q AGENTS.md CLAUDE.md` → idénticos (32225 bytes cada uno).
- `gentle-ai skill-registry refresh --force` → `rg owasp-security .atl/skill-registry.md` encuentra la fila, scope `project`.
- `pnpm run verify` → **EXIT=0** (lint + typecheck + lint/typecheck de tests + test + build + boundaries + test:boundaries). `depcruise`: sin violaciones (1244 módulos). `test:boundaries`: 163/163. Los «2 problems» de lint son los **dos warnings preexistentes** de `admin-users.test.tsx` (0 errores), ya anotados en otra bitácora.

## Lo que queda para el ojo humano

- Decidir si además conviene instalar la skill genérica auditada (`addyosmani/...security-and-hardening`) como base de profundidad — no se hizo para no duplicar triggers de seguridad.
- Resolver qué hacer con la copia vieja y con rutas absolutas de `.atl/skill-registry.md` en el repo (limpiar del índice, o portabilizar las rutas).
