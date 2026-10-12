# Bitácora: orden del backlog (Vaqcrow-TFM) — 2026-10-12

Reconciliar los issues abiertos y el tablero **Vaqcrow-TFM** (Project #4) contra la realidad del repo. Pedido del owner: "organizame el backlog, fijate qué falta por hacer, cerrá todo lo que esté hecho".

## Inventario inicial

- **221 issues cerrados**, **12 abiertos**:

| # | Tipo | Título | Board | Sub-issues |
|---|---|---|---|---|
| 9 | Epic | Integration, resilience and evidence | Backlog | 3/3 cerrados → **cerrar** |
| 373 | Epic | Public site | Backlog | 2/2 cerrados → **cerrar** |
| 10 | Epic | Demo delivery and presentation | Backlog | 5/6 (falta #32) |
| 32 | Feature | Prepare independent deployment environments | Ready | 0/3 (#101/#102/#103) |
| 101 | Task | Implement independent deployment environments | Ready | — |
| 102 | Task | Test independent deployment environments | Backlog | — |
| 103 | Task | Document evidence for independent deployment environments | Backlog | — |
| 375 | Epic | Admin console | Backlog | 2/3 (falta #390) |
| 390 | Feature | Manage users, roles, operator invitations and the audit log | Backlog | 0/3 |
| 391 | Task | Implement users, roles, operator invitations and the audit log | Backlog | — |
| 392 | Task | Test users, roles, operator invitations and the audit log | Backlog | — |
| 393 | Task | Document evidence for users, roles, operator invitations and the audit log | Backlog | — |

## Hallazgos (verificados en el repo)

- **#9 y #373**: todos sus hijos cerrados → listos para cerrar; el board estaba desactualizado (Backlog).
- **#32**: **resultado vivo** (API en Railway + web en Vercel), pero **NO completo**: `deploy-planning.md` §8 deja sin marcar los workflows `deploy-dev.yml`/`deploy-production.yml`, los secrets de GitHub, las env de Vercel, el builder a nivel servicio y los smoke tests. Artefactos presentes: `apps/api/Dockerfile`, `.dockerignore`, `.npmrc` en ambos stages, `deploy-planning.md` retargeteado a Railway (0 menciones de Fly.io), MCP de Railway en `.mcp.json` y `opencode.json`. → **no cerrar**; decidir si se termina o se cierra "como está".
- **#390**: **no implementado** (no existe vista Usuarios/invitaciones/auditoría en `/admin`; hay `(console)/pymes` y su evidencia). Tiene **preguntas de diseño abiertas** que el owner debe decidir antes de implementar. → **no cerrar**.
- **#10** espera #32; **#375** espera #390.

## e2e (credenciales)

- **No hubo bloqueo.** El mecanismo **ya existe**: `scripts/env/generate-docker-env.sh` genera `.env.docker` (gitignored) desde `.env.cloud`, y el e2e-live lo lee con `readDockerEnv` (`node fs`). Verificado: `.env.docker` existe y es legible por `node fs` (el sandbox no lo bloquea).
- Para **correr** el e2e-live falta levantar el stack docker local (Supabase local + API container + Quickstart), pesado en esta máquina (ver handoff). No es un problema de credenciales.

## Acciones

- [x] Cerrar #9 (comment + close) y board → Done.
- [x] Cerrar #373 (comment + close) y board → Done.
- [x] Reportar #32/#10/#390/#375 con recomendación (no cerrar; requieren decisión).
- [x] Decisión del owner (2026-10-12): **#32 fuera de alcance** → cerré #101/#102/#103/#32 como *not planned* y, con eso, **#10** (todos sus hijos cerrados). Los 5 → Done en el board.
- [ ] #375/#390/#391/#392/#393: quedan abiertos — requieren decisiones de diseño del owner antes de implementar.

## Estado final

**5 abiertos**, todo el bloque *Admin › Usuarios*: #375 (Epic Admin console), #390 (Feature) + #391/#392/#393 (Tasks). El resto del backlog está cerrado (226 issues).

## Route

Direct inline: trabajo de `gh` (estado) + lectura del repo; sin writers.
