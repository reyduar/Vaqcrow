# Bitácora: retirar estados de issues de los docs vivos + refrescar el README

Retirar el **estado de los issues** (merge/PR/`en main desde`/rama/board) de los documentos de estado *vivos* y actualizar el README (diagramas actuales + logo). Decisión del owner (2026-10-12).

## Alcance (decidido con el owner)

- **Incluye:** `README.md`, `AGENTS.md`, `CLAUDE.md`.
- **Excluye (registro histórico, intacto):** el corpus `docs/planning/*-evidence.md`, la hoja de ruta `docs/planning/demo-tasks-list.md` y `odd/tasks/*`.

Principio que esto instaura: **el tablero Vaqcrow-TFM es la fuente de verdad del estado; la documentación describe el producto y la arquitectura, no el estado de los issues.** (Invierte la política de `odd/tasks/roadmap-status-sanitation.md`, que sincronizaba estados con GitHub.)

## Tareas

- [x] T1 — README: retirar toda la prosa de estado de issue (incluida la línea **desactualizada** que dice que las cuentas están "todavía fuera de `main`").
- [x] T2 — README: actualizar los tres diagramas Mermaid a la arquitectura actual.
- [x] T3 — README: modernizar con el isotipo (`apps/web/public/vaqcrow-isotipo.png`) y encabezado alineado.
- [x] T4 — AGENTS.md + CLAUDE.md: neutralizar los estados en "Settled decisions", manteniendo las decisiones y los gemelos byte-idénticos.
- [x] T5 — Verificación: readback, `diff AGENTS.md CLAUDE.md`, y grep sin coincidencias de los patrones de estado.

## Route

Direct inline (RA-1). Los tres archivos se editan juntos porque comparten la misma regla y los gemelos `AGENTS.md`/`CLAUDE.md` deben quedar byte-idénticos; el padre tiene el contenido completo en contexto. Sin writer delegado.

## Verificación

- [x] `diff -q AGENTS.md CLAUDE.md` → idénticos ✅.
- [x] `grep -nE "en \`main\` desde|desde PR #|merge de|todavía fuera de \`main\`|on \`main\`|since PR #|Rama e implementación"` sin coincidencias en README/AGENTS ✅ (0).
- [x] Readback de los diagramas (3 bloques `mermaid`; se quitó el número de issue de las flechas).

## Notas

- El isotipo es el único asset de marca disponible (no hay wordmark).
- No se toca el corpus de evidencia ni `odd/` (histórico).
