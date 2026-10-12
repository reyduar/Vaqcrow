# Bitácora: Feature #390 — Admin › Usuarios (roles, invitaciones y auditoría)

La última pieza abierta del backlog: la vista **Admin › Usuarios**. Hoy `/admin` tiene *PyMEs* (cola, revisión, evidencia) pero no gestión de usuarios.

- **Issue:** #390 (Feature) · Tasks #391 (implement) / #392 (test) / #393 (evidence) · padre #375 (Epic Admin console).
- **Template (fuente de verdad):** `docs/design/template/Vaqcrow Admin.dc.html`, vista `users`.
- **Rama:** `Vaqcrow#390_Feat_Manage_users_roles_operator_invitations_and_the_audit_log`.

## Decisiones del owner (2026-10-12)

1. **Invitación — mínima correcta.** Modal con **solo email** → Supabase Auth invita (email por Resend; evento `admin.operator_invited` ya existe) → el invitado acepta en una **pantalla propia** donde define nombre + contraseña → queda `ADMIN` activo. La fila aparece **«Invitado»** hasta que acepte. **Sin** reenviar/revocar en el MVP.
2. **Cambio de rol.** Control en la pastilla de Rol para cambiar **PYME ↔ INVERSOR** con confirmación + auditoría. **`ADMIN` queda fuera del control**: solo se obtiene por invitación.
3. **KYC.** El admin ve una etiqueta de KYC (simulada) por usuario, **solo lectura** (inversores: «Sin iniciar» / «Aprobado · simulado»; PyMEs su estado simulado). Sin aprobación manual.
4. **Búsqueda/filtros/paginación.** **Completo** en usuarios y auditoría (búsqueda, filtros por rol/estado, paginación).

## Qué ya existe (se aprovecha)

- El **shell de `/admin`** y el route group `(console)` (`apps/web/src/app/admin/(console)`).
- **Auth real** (Supabase Auth, roles, RLS) + autorización por rol en la API.
- El **`AuditLogPort`** (`apps/api/src/application/ports/audit-log-port.ts`; `AuditEntry` + `append()`, append-only) y su adaptador `supabase-audit-log.ts`.
- El evento **`admin.operator_invited`** en `notification-catalogue.ts`.
- El **template** que diseña tabla, botón «Invitar operador», diálogo de confirmación y sección de auditoría.

## Qué se construye (no existe)

- Lectura de usuarios (`GET /admin/users`) con búsqueda/filtros/paginación.
- Activación/desactivación con **protección del último admin activo**.
- Invitación de operador (`POST /admin/invitations`) + pantalla de aceptación.
- Cambio de rol PYME↔INVERSOR.
- Lectura de auditoría (`GET /admin/audit-log`) con paginación.
- La vista web `/admin/users` y la pantalla de aceptación.

## Work units

- [ ] **WU1 — Contratos y dominio** (`packages/contracts`, `packages/domain`): shapes de usuario/rol/estado/KYC, query de listado (búsqueda/filtros/paginación), entrada de auditoría, invitación; reglas de dominio (transiciones de rol permitidas PYME↔INVERSOR; protección del último admin).
- [ ] **WU2 — API read** (`GET /admin/users`, `GET /admin/audit-log`): ADMIN-only, con ports/adapters Supabase y paginación.
- [ ] **WU3 — API mutations**: activate/deactivate (guarda del último admin), cambio de rol, invitación (`POST /admin/invitations` vía Supabase invite + notificación), cada una escribiendo auditoría.
- [ ] **WU4 — Web: vista `/admin/users`**: tabla + KYC badge + búsqueda/filtros/paginación + Activar/Desactivar + cambio de rol + modal de invitación + diálogo de confirmación + sección de auditoría.
- [ ] **WU5 — Web: pantalla de aceptación de invitación** (nombre + contraseña).
- [ ] **WU6 — Tests** (#392).
- [ ] **WU7 — Evidencia** (#393): `docs/planning/<slug>-evidence.md` (español, criterios verbatim) + este log.

## Reglas y límites

- **No custodial / IA asesora / Testnet** se preservan; el KYC del inversor es simulado y auto-aprobado.
- Todo lo que el template no diseña se decide (arriba), no se inventa.
- Rutas en inglés; UI en español (voseo rioplatense); tokens/estados del template.
- `ADMIN` solo por invitación; el último admin activo no se puede desactivar.
- Sin secretos, tokens, PII ni claves en el repo.

## Route

Por definir por WU (inline o writer delegado según tamaño). WU1 se puede hacer inline (contratos + dominio, entendidos); WU2–WU5 tocan 2+ archivos no triviales → probablemente writer delegado por unidad.
