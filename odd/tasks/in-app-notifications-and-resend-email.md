# Bitácora — Feature #382: notificaciones in-app y email con Resend

## Objetivo

Entregar la campana de notificaciones in-app (con contador de no leídas y el modal del template) para los tres roles —ADMIN, PYME e INVERSOR— más el envío de email por la **API de Resend**, detrás de un puerto y un adaptador, con el catálogo de eventos definido por el owner. La entrega es **idempotente por evento** y **un fallo de email nunca bloquea la acción de origen**. Feature [#382](https://github.com/reyduar/Vaqcrow/issues/382) del Epic [#377](https://github.com/reyduar/Vaqcrow/issues/377).

## Ramas y entrega

- **Rama de integración:** `Vaqcrow#382_Feat_Deliver_in_app_notifications_and_Resend_email`, creada desde la punta de la pila #398/#399/#400/#401 y #406/#407/#408/#409 (`be6b758`, tip de #409).
- **Opción A del owner (vigente):** nada llega a `main` todavía; toda la pila se mergea junta con **#438** al final. No hay PR ni merge en esta Feature.
- **Slices locales (unidades de trabajo revisables):** T1a (migración) → T1b (API puertos/adaptadores/config) → T1c (API rutas) → T1d (web campana + modal) → T2 (#384 pruebas) → T3 (#385 evidencia).
- **Forecast de líneas (heurística ~400/tarea, no un tope):** la Feature es grande (migración + API + web + docs). Se cuenta el acumulado del branch; sin merge no hay PR que dividir. Si el acumulado se dispara, se registran los slices en vez de forzar un split artificial.

## Fuente de diseño

Template exportado por el owner en `docs/design/template/` (directorio ignorado por git):

- `Vaqcrow Admin.dc.html` — **única** pantalla que diseña la campana y el modal:
  - Campana (línea 55): botón `44×44`, `aria-label="{{ notifAria }}"` = `"Notificaciones, N sin leer"`, ícono `notifications-outline`, badge de no leídas (`background: var(--accent)`, `min-width:18px`, `border-radius:999px`, `font-size:11px`).
  - Modal (líneas 122–126): overlay + `role="dialog"` `aria-modal="true"` `aria-labelledby`, título "Notificaciones", subtítulo "N sin leer" / "Todo leído", lista con acordeón (`aria-expanded`), tag **NUEVA**, hora ("Hoy · 09:42"), cuerpo, CTA opcional.
  - Estado (líneas 171–173): `markAll` marca todo leído; `notifSub` = "N sin leer"/"Todo leído"; `notifAria` = "Notificaciones, N sin leer".
- `docs/design/design_handoff_vaqcrow/` — handoff de diseño (README, brief, screens).

> [!warning] La campana solo está diseñada en el shell de Admin
> El template **no** dibuja la campana en los headers de PYME ni de INVERSOR. El owner decidió (2026-10-04) replicar **exactamente** la campana y el modal de Admin en el header público existente para PYME e INVERSOR. La pantalla `/admin` todavía no existe (es [#386](https://github.com/reyduar/Vaqcrow/issues/386)); el componente se construye igual y su montaje en Admin espera a esa Feature.

## Decisiones del owner (2026-10-04)

| # | Pregunta (issue #382, «Not designed in the template») | Resolución (owner) |
|---|---|---|
| a | Dónde va la campana en el header público de PYME/INVERSOR | **Exactamente como el template de Admin.** Se replica la campana + modal de `Vaqcrow Admin.dc.html` para los tres roles; en PYME/INVERSOR se monta en el header público (`AppHeader`). El montaje en Admin espera a #386. |
| b | Copy de notificaciones de PyME/inversor y plantillas de email (asunto, cuerpo, remitente, idioma) | **El agente redacta el borrador** en español neutro (voseo); **el owner lo aprueba**. Cubre los textos de los eventos de PyME/inversor (el template solo diseña los 4 de admin) y el email. Remitente candidato: `Vaqcrow <no-reply@vaqcrow.com>` (dominio verificado en Resend). |
| c | Preferencias, baja (unsubscribe), agrupación (batching) y página completa | **Solo el modal.** Sin panel de preferencias, sin unsubscribe (email transaccional), sin batching (un email por evento), sin página `/notifications`. |

## Catálogo de eventos (14; lo define el owner, issue #382)

| Rol destinatario | Evento |
|---|---|
| ADMIN | nueva solicitud; transacción pendiente; meta alcanzada; operador invitado |
| PYME | cambios requeridos; aprobada/publicada; meta alcanzada; declarar ventas del mes; distribución lista para firmar |
| INVERSOR | aporte confirmado; meta alcanzada; distribución recibida; reembolso disponible |

**Seam registrado:** #382 entrega el puerto, el catálogo, la persistencia y la entrega. Las Features que **levantan** los eventos publican por ese puerto; la primera consumidora real es [#402](https://github.com/reyduar/Vaqcrow/issues/402) (envío a revisión → notifica al admin). Por eso, en #382 no hay call-sites de producción todavía: la verificación es con dobles (tests) y el contrato del puerto.

## Arquitectura (seams a construir)

- **Puertos (API, `apps/api/src/application/ports/`):** `NotificationPublisher` (mapea evento → destinatario(s), persiste la notificación in-app y dispara el email; idempotente por evento; no deja que un fallo de email rompa la acción de origen) y `EmailPort` (envío saneado, nunca lanza hacia el llamador).
- **Adaptadores (API, `infrastructure/adapters/`):** repositorio Supabase de notificaciones (`service_role`, errores saneados) y `ResendEmailAdapter` (API HTTP de Resend).
- **Migración:** tabla de notificaciones por destinatario, con RLS (cada usuario lee solo lo suyo; admin lee lo dirigido a admin), clave de idempotencia por evento y `read_at`. Patrón del repo: `service_role`-only, RLS on, grants explícitos, `CHECK`/`UNIQUE`; local-docker → remoto en la misma unidad, reconciliando `schema_migrations`.
- **Rutas API:** listar notificaciones del principal, contador de no leídas, marcar una leída y marcar todas. Toda ruta nueva se suma a `route-policy.ts` **y** a sus tests pinneados (`route-policy.test.ts`, `authorization.test.ts`, `build-app.test.ts`).
- **Web:** componente campana + modal fiel al template, puerto/adaptador HTTP, y montaje en `AppHeader` para PYME/INVERSOR. Estado de servidor vía SWR si el repo ya lo usa (verificar antes de escribir).
- **Email:** es la **API de Resend**, distinta del SMTP de Supabase Auth ya configurado (confirmación de cuenta). La API key y el remitente son variables de entorno; `scripts/demo/preflight` y los módulos de config de la API cambian juntos.

## TDD

- Modo: **activado** (RED observado antes del GREEN).
- Runners: Vitest (API y web), pgTAP (`pnpm run test:db`) para migración/RLS, y Testing Library para la campana/modal. Los tests del PR **nunca** llaman a Resend vivo, a Supabase, a Testnet ni al LLM: usan dobles.
- Skills a cargar antes de escribir: `supabase`, `supabase-postgres-best-practices` (migración/RLS), `heroui-react` y `frontend-design` (UI), `zustand` si se toca estado de cliente.

## Tareas

- [ ] **T1 (#383) — Implementar.**
  - [ ] **T1a — Migración + pgTAP.** Tabla de notificaciones + RLS + idempotencia. Local → remoto.
  - [ ] **T1b — API puertos/adaptadores/config.** `NotificationPublisher` + `EmailPort`, catálogo, repositorio Supabase, `ResendEmailAdapter`, slice `email-config` + espejo en preflight. Tests con dobles.
  - [ ] **T1c — API rutas.** Listar / contador / marcar una / marcar todas + política y tests pinneados. Cableado en `build-app`/`index.ts`.
  - [ ] **T1d — Web campana + modal.** Componente fiel al template, puerto/adaptador, montaje en `AppHeader` para PYME/INVERSOR. Tests.
- [ ] **T2 (#384) — Probar.** Cobertura determinista: evento→destinatario por cada entrada del catálogo, idempotencia en replay, aislamiento del fallo de email, contador de no leídas, marcar una/todas, accesibilidad del modal (`aria-expanded`, foco) y RLS (un usuario no lee lo ajeno).
- [ ] **T3 (#385) — Evidencia.** `docs/planning/in-app-notifications-and-resend-email-evidence.md` (en español), con cada criterio de aceptación citado textualmente y su fuente de verificación. Alinear `CLAUDE.md`/`AGENTS.md` (gemelos), `docs/architecture/environments.md` y `docs/planning/DEMO.md`.

## Próximo paso

Arranca **T1a (#383)**: migración de notificaciones + RLS + idempotencia, local-docker → remoto, con pgTAP RED→GREEN.
