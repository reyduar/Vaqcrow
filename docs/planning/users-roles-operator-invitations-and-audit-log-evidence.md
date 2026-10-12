# Evidencia de cierre de la Feature #390 — Issue #393

> Documento de cierre de Feature. Consolida la evidencia de las Tasks [#391](https://github.com/reyduar/Vaqcrow/issues/391) (implementación), [#392](https://github.com/reyduar/Vaqcrow/issues/392) (pruebas) y [#393](https://github.com/reyduar/Vaqcrow/issues/393) (evidencia) de la Feature [#390](https://github.com/reyduar/Vaqcrow/issues/390) ("Feature: Manage users, roles, operator invitations and the audit log", Epic [#375](https://github.com/reyduar/Vaqcrow/issues/375) "Epic: Admin console"). Mapea cada criterio de aceptación, citado textualmente, a su resultado y a la fuente de ese resultado. La bitácora de iteración es [[odd/tasks/manage-users-roles-invitations-and-audit-log|Bitácora: Admin › Usuarios]].

> [!info] Alcance real: la vista **Admin › Usuarios** sobre las pantallas del template
> La Feature entrega la vista `users` de `docs/design/template/Vaqcrow Admin.dc.html`: la tabla de usuarios, activar/desactivar, el cambio de rol, la invitación de operador y el registro de auditoría. Se implementó en seis unidades de trabajo (un commit por unidad), con tests determinísticos por unidad. **No** hay migración: se reutilizan `public.profile`, `public.audit_log`, `public.investor_kyc` y los triggers de identidad existentes.

## 1. Contexto y objetivo

#390 es la última pieza de la consola de administración: hoy `/admin` tiene *PyMEs* (cola, revisión, evidencia) pero no gestión de usuarios. La Feature agrega el módulo *Usuarios* —roles y acceso— con el botón «Invitar operador», activar/desactivar, cambio de rol y el «Registro de auditoría» que el template diseña.

| Task | Rama | Cierre |
|---|---|---|
| #391 — implementar | `Vaqcrow#390_Feat_Manage_users_roles_operator_invitations_and_the_audit_log` | commits de código (§3) |
| #392 — probar | (misma rama) | suites determinísticas (§5) |
| #393 — documentar | (misma rama) | este documento |

## 2. Cómo leer esta evidencia

- **Fuentes, siempre nombradas.** (a) **Comandos re-ejecutados** en este árbol de trabajo; (b) **corpus citado** — un documento ya verificado. No se re-deriva nada.
- **Sin secretos ni PII.** Ningún email, contraseña, token, seed ni clave. Las variables se nombran, nunca sus valores.
- **Sin claims de producción.** Demo en Testnet sin valor económico; KYC/KYB simulado; IA asesora; no custodial.
- **Trazabilidad.** Cada resultado nombra la unidad (commit) y el comando que lo produjo.

## 3. Qué se entregó (por unidad de trabajo)

| WU | Commit | Alcance |
|---|---|---|
| WU1 | `f20a174` | **Contratos + dominio.** `packages/contracts/src/admin-users.ts` (fila de usuario con rol/estado/KYC/`isSelf`, query y página con búsqueda/filtros/paginación, comandos de activación y cambio de rol, invitación, vista de auditoría) y `packages/domain/src/admin-users.ts` (cambio de rol PYME↔INVERSOR; guarda de desactivación: no a uno mismo, nunca al último admin activo). El comando de rol **excluye `ADMIN`**. |
| WU2 | `627f121` | **API read** (`GET /admin/users`, `GET /admin/audit-log`), ADMIN-only, paginados. El listado compone `profile` + Auth Admin `listUsers` (email/última actividad/estado *invited*) + `investor_kyc`; la auditoría pagina server-side. |
| WU3a | `05af26a` | **API mutaciones**: `POST /admin/users/:userId/activation` (guarda `canDeactivateUser`) y `POST /admin/users/:userId/role` (PYME↔INVERSOR), cada una con una entrada de auditoría. |
| WU3b | `55f5a96` | **API invitación**: `POST /admin/invitations` espejando el patrón del seed (dos triggers) con **rollback** si falla la promoción; auditoría + notificación in-app best-effort. |
| WU4 | `f80c897` | **Web `/admin/users`**: tabla del template + badge KYC (solo lectura) + búsqueda/filtros/paginación + Activar/Desactivar + cambio de rol + modal de invitación + «Registro de auditoría»; nav «Usuarios» pasa a link real. |
| WU5 | `15b7da4` | **Aceptación de la invitación**: contraseña client-side (`updateUser`) + nombre vía `POST /admin/invitations/accept { displayName }` (AUTHENTICATED); pantalla `/accept-invitation`. |

## 4. Decisiones del owner (2026-10-12)

1. **Invitación mínima correcta**: email → pantalla de aceptación; fila «Invitado» hasta aceptar; sin reenviar/revocar.
2. **Cambio de rol** PYME↔INVERSOR con confirmación y auditoría; `ADMIN` **solo** por invitación.
3. **KYC** del inversor visible para el admin, **solo lectura**.
4. **Búsqueda/filtros/paginación** completos (usuarios y auditoría).
5. **Aceptación**: ruta dedicada `POST /admin/invitations/accept`; contraseña client-side, nombre por la API.

## 5. Verificación (comandos re-ejecutados y resultados observados)

| Comando | Resultado observado |
|---|---|
| `pnpm --filter @vaqcrow/contracts test` | **714 passed** (26 files) |
| `pnpm --filter @vaqcrow/domain test` | **130 passed** (3 files) |
| `pnpm --filter @vaqcrow/api test` | **2943 passed** (140 files) |
| `pnpm --filter @vaqcrow/web test` | **2160 passed** (215 files) |
| `pnpm --filter @vaqcrow/api typecheck` y `…/web typecheck` | exit 0, sin errores |
| `pnpm run boundaries` | *no dependency violations found* (1226 modules, 4090 dependencies) |
| `pnpm run verify` (gate completo) | **parcial por carga**: 2 tests web **no tocados por esta Feature** (`admin-review-decision.test.tsx`, `pyme-onboarding-wizard.test.tsx`) fallaron por timeout de 5 s bajo la carga del gate; **corridos en aislamiento: 26 passed**. Es el flake documentado de `@vaqcrow/web` ([[docs/planning/resilience-telemetry-and-fallbacks-evidence|#31]] §5.1), no una regresión. |

## 6. Límites honestos

1. **Sin e2e contra GoTrue vivo.** La aceptación real de una invitación (link del email → sesión → setear contraseña) no se corrió contra un Supabase vivo; el `detectSessionInUrl`/PKCE de `@supabase/ssr` se verificó a nivel de dependencia. Es un paso de operador.
2. **Sin migración.** La Feature no crea tablas ni vistas: reutiliza `profile`, `audit_log` e `investor_kyc` y los triggers de identidad.
3. **El listado de usuarios filtra/pagina en memoria** (escala demo, documentado en el adapter); la auditoría sí pagina server-side.
4. **Nombre provisional.** El alta del admin requiere un `display_name`; el invariante D3 prohíbe derivarlo del email, así que el invitado queda como «Operador invitado» hasta que acepta (WU5 lo reemplaza).
5. **`pnpm run verify` no cerró verde** por el flake de carga descrito en §5; los archivos afectados pasan en aislamiento y no pertenecen a esta Feature.
6. **Fuera de alcance por decisión**: reenviar/revocar invitación, búsqueda server-side del listado de usuarios, y edición de perfil genérica.

## 7. Mapeo de criterios de aceptación

Los criterios se citan **textualmente** desde cada issue.

### Feature #390

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "The users table, activate/deactivate confirmation and audit log match the template and operate on real data." | ✅ La vista `/admin/users` reproduce la tabla del template y opera sobre `GET /admin/users` + `POST …/activation` + `GET /admin/audit-log` reales. | WU4 `f80c897`, WU2 `627f121`, WU3a `05af26a` |
| 2 | "An admin can invite another admin by email; no public path creates an admin." | ✅ `POST /admin/invitations` (ADMIN-only) espeja el seed; el rol `ADMIN` solo se obtiene por `app_metadata` (service role), nunca por el cliente. | WU3b `55f5a96` |
| 3 | "Deactivated users lose access; the admin's own row shows 'Tu cuenta' and cannot be deactivated." | ✅ `profile.status='inactive'` → el hook responde 401; la guarda `canDeactivateUser` impide auto-desactivarse y `isSelf` muestra «Tu cuenta». | WU3a `05af26a`, WU1 `f20a174` |
| 4 | "Every admin action writes an audit entry with date, time and actor." | ✅ Activación, cambio de rol e invitación escriben una entrada append-only con actor = principal verificado. | WU3a `05af26a`, WU3b `55f5a96` |
| 5 | "Admin sees investor KYC status and can deactivate without any approval step." | ✅ Badge KYC solo-lectura por usuario (inversores: `approved_simulated`/`not_started`); sin aprobación manual. | WU4 `f80c897`, WU2 `627f121` |
| 6 | "Required evidence and failure behavior are covered." | ✅ Este documento + la bitácora; los caminos de fallo (404/409/503, no-leak, rollback de invitación) están cubiertos por tests. | §5, §6 |
| 7 | "Every item under 'Not designed in the template (open question)' is decided by the owner before it is implemented; none is invented." | ✅ Las 5 preguntas abiertas se decidieron el 2026-10-12 (§4); nada se inventó. | §4 |
| 8 | "No unsupported production claims or secrets are introduced." | ✅ Sin secretos ni PII; encuadre simulado/Testnet preservado. | §2, §6 |

### Task #391 — implementación

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Feature #390 behavior is implemented within its documented boundary, matching the template screens and copy it cites." | ✅ Implementado en la superficie permitida; rutas en inglés, UI y copy según el template. | §3 |
| 2 | "Failure paths remain truthful and do not weaken security, simulation, non-custodial or human-control boundaries." | ✅ Errores `{ code }` saneados; `ADMIN` solo por invitación; el invitado se auto-escribe solo su nombre. | §3, §5 |
| 3 | "No behavior outside the template is invented; open questions are not implemented before the owner decides." | ✅ Decisiones registradas (§4); sin reenviar/revocar ni perfil genérico. | §4 |

### Task #392 — pruebas

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Deterministic tests or bounded rehearsal checks demonstrate the core behavior of Feature #390." | ✅ Suites determinísticas por unidad (contratos, dominio, adapters, rutas, modelos y componentes web), sin red ni servicios vivos. | §5 |
| 2 | "Validation, rejection, and fallback behavior is covered where applicable." | ✅ Cubiertos: 401/403/400/404/409/503, guardas de dominio, `email_exists`, rollback de promoción, sesión/contraseña inválidas. | §5 |
| 3 | "The focused verification passes without exposing sensitive data." | ✅ Sin secretos ni PII en fixtures ni salidas; el fallo de `verify` es carga, no datos (§5). | §5 |

### Task #393 — evidencia

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Evidence identifies Feature #390, verification commands or rehearsal steps, and observed results." | ✅ Este documento identifica la Feature y sus Tasks, y lista comandos y resultados. | §1, §5 |
| 2 | "`docs/planning/users-roles-operator-invitations-and-audit-log-evidence.md` exists, is written in Spanish and follows the sibling evidence documents." | ✅ Este archivo, en español y con la estructura de los documentos hermanos. | Este documento |
| 3 | "Evidence is traceable to implementation and focused verification." | ✅ Cada WU nombra su commit; cada resultado nombra su comando. | §3, §5 |
| 4 | "Sensitive data and unsupported production claims are excluded." | ✅ Sin secretos ni PII; sin claims de producción. | §2, §6 |

## 8. Estado de entrega

- Cambios: `packages/contracts/src/admin-users.ts`, `packages/domain/src/admin-users.ts`, `apps/api/src/**` (ports, adapters, use cases, rutas, policy), `apps/web/src/**` (application, infrastructure, presentation, rutas) y la bitácora `odd/tasks/manage-users-roles-invitations-and-audit-log.md`.
- La Feature y sus Tasks se cierran cuando el owner lo decide; este documento es la evidencia de cierre del Task #393.
