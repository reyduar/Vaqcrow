# Bitácora: creación de cuentas, ingreso y shell según el rol

## Objetivo

Alta e ingreso reales con Supabase Auth desde `apps/web`, sesión real, header que cambia según haya sesión y según el rol, cierre de sesión y redirección por rol. Task [#379](https://github.com/reyduar/Vaqcrow/issues/379) de la Feature [#378](https://github.com/reyduar/Vaqcrow/issues/378) (Epic [#368](https://github.com/reyduar/Vaqcrow/issues/368)).

## Ramas y entrega

- Rama de integración: `Vaqcrow#378_Feat_Provide_account_creation_sign_in_and_a_role_aware_shell`, creada desde la rama de la Feature #369 con #370–#372 mergeadas (`8688136`).
- Rama de trabajo: `Vaqcrow#379_Task_Implement_account_creation_sign_in_and_the_role_aware_shell`; su PR apunta a la rama de #378.
- **Entrega apilada:** #369 y #378 llegan juntas a `main`, junto con el retiro del recorrido de seis pasos ([#438](https://github.com/reyduar/Vaqcrow/issues/438)); `main` nunca corre el recorrido contra la API autorizada.

## Fuente de diseño

Template exportado por el owner el 2026-10-02 en `docs/design/template/` (directorio ignorado por git):

- `Vaqcrow Onboarding.dc.html` — alta («Creá tu cuenta») e ingreso («Ingresá a tu cuenta») en una sola pantalla con dos modos.
- `Vaqcrow Portafolio.dc.html` — «Mi portafolio» (inversor) y «Mi campaña» (PyME).
- `Vaqcrow Landing.dc.html` — header público con «Ingresar» / «Crear cuenta».
- `assets/avatar-inversor.png`, `assets/avatar-pyme.png`, `assets/vaqcrow-isotipo.png` — se copian a `apps/web/public/`.

Las decisiones están en `CLAUDE.md`/`AGENTS.md` (commit `5a4225d`) y en los comentarios del 2026-10-02 en #378, #398, #402, #410, #418, #426, #434 y #438.

## Decisiones del owner (2026-10-02)

| # | Decisión |
|---|---|
| D1 | Rutas siempre en inglés: `/`, `/signup`, `/login`, `/portfolio` (Mi portafolio), `/company` (Mi campaña). |
| D2 | El ingreso redirige según el rol del perfil verificado: `INVERSOR` → `/portfolio`, `PYME` → `/company`. El selector «Soy inversor / Soy PyME» del ingreso sólo cambia los textos. |
| D3 | El alta exige «Nombre completo» (inversor) o «Nombre o Razón Social» (PyME), mínimo 2 caracteres, guardado como `display_name`. El email no se muestra nunca en la UI. |
| D4 | Menú del avatar: avatar por rol, nombre y chip de rol, sin «Sesión de demostración». Inversor: Mi portafolio, Guía de inversión, Informes, Centro de ayuda, Cerrar sesión. PyME: Mi campaña, Guía para emprendedores, Centro de ayuda, Cerrar sesión. |
| D5 | Copy de reemplazo: «Demo en Stellar Testnet: los activos no tienen valor económico.»; «Cuenta creada. Confirmá tu correo desde el enlace que te enviamos para poder ingresar.»; errores de ingreso «Correo o contraseña incorrectos.», «Todavía no confirmaste tu correo. Revisá el enlace que te enviamos.» y «No pudimos ingresar. Hubo un error de red; revisá la conexión y volvé a intentar.». |
| D6 | Alcance de #379: `/`, `/portfolio` y `/company` quedan como esqueletos (header + título y subtítulo del template), protegidos por sesión y rol; el contenido llega con #418, #426 y #434. El recorrido de seis pasos no se toca acá. |

## TDD

- Modo: **activado** (RED observado antes del GREEN).
- Runners: Vitest + Testing Library en `apps/web` (`pnpm --filter @vaqcrow/web exec vitest run <archivo>`), pgTAP (`pnpm run test:db`, stack local del perfil docker).
- Los tests de PR usan un doble de Supabase Auth; ninguno depende del proveedor real.

## Tareas

- [x] **T1 — `display_name` obligatorio en el alta.** Migración nueva: el trigger de alta rechaza `PYME`/`INVERSOR` sin `display_name` (mínimo 2 caracteres tras trim) y deja de usar la parte local del email; lo mismo en la promoción a `ADMIN`. pgTAP primero. Probar local y aplicar al remoto en la misma unidad.
  - Ruta: delegada (writer acotado). Archivos: `supabase/migrations/20261002120000_require_signup_display_name.sql`, `supabase/tests/identity_and_audit.sql`, `supabase/tests/admin_promotion.sql`, `docs/architecture/identity-and-rls-boundaries.md`.
  - RED (`pnpm run test:db`, stack local sin la migración): `identity_and_audit.sql` falla 24–28 (`caught: no exception / wanted: 22023` para sin nombre, en blanco, 1 carácter y ADMIN sin nombre; «creates no profile row» `have: 4 want: 0`); `admin_promotion.sql` falla 7 (`caught: no exception / wanted: 22023`).
  - Diseño: `handle_new_user()` rechaza con `22023` un nombre nulo o de menos de 2 caracteres tras `btrim`, sin fallback al email ni a `'user'`. `promote_admin_on_app_metadata()` trata un nombre de menos de 2 caracteres como ausente; con perfil existente hace `UPDATE` y conserva nombre y usuario; sin perfil exige nombre válido. El `UPDATE` previo es necesario: un `insert ... values (null)` viola el `not null` de `display_name` antes de llegar al `on conflict`.
  - GREEN parcial (`pnpm exec supabase migration up --local` + `pnpm run test:db`): `identity_and_audit.sql` ok, `admin_promotion.sql` ok; **`admin_rls_scope.sql` falla** (`ERROR: display name is required (at least 2 characters)`, línea 21): sus fixtures crean `PYME`/`INVERSOR` sin `display_name` y ese archivo está fuera de la superficie autorizada.
  - Seed: `seed-superadmin.ts` crea con `user_metadata { role: INVERSOR, display_name }` y promueve con `app_metadata.display_name`; pasa el trigger estricto sin cambios. `vitest run src/infrastructure/seed` 35/35; `@vaqcrow/api test` 1371/1371.
  - Orquestador: los fixtures `PYME`/`INVERSOR` de `supabase/tests/admin_rls_scope.sql` pasan a llevar `display_name` («Scope Pyme», «Scope Inversor»; sólo datos de prueba). GREEN: `pnpm run test:db` → `Files=9, Tests=173, Result: PASS`.
  - Remoto (2026-10-02, MCP de Supabase): `apply_migration` con el cuerpo del archivo (SHA-256 `1ddef17a…44b9b`) y versión del historial alineada de `20261002145137` a `20261002120000`. Verificado: `handle_new_user()` y `promote_admin_on_app_metadata()` siguen `security definer` con `search_path=""`, sin EXECUTE para `anon`/`authenticated`, sin `split_part` (sin fallback al email) y con el rechazo de nombre de menos de 2 caracteres. Advisor de seguridad: el INFO `rls_enabled_no_policy` esperado (12 tablas sólo `service_role`) y un `WARN` `auth_leaked_password_protection` («Leaked Password Protection Disabled»), una opción del panel de Auth que no depende de esta migración; queda como decisión del owner.
  - Commit: `feat(db): require a display name at signup instead of deriving it from the email`.
- [ ] **T2 — Sesión en la web.** `@supabase/supabase-js` en `apps/web`; puerto de sesión en `application/ports`, adaptador en `infrastructure/`, store/provider por montaje en `state/`; el cliente HTTP manda `Authorization: Bearer` con el token vigente; variables `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` alineadas en ejemplos de env, preflight y docs.
- [ ] **T3 — `/signup` y `/login`.** La pantalla del template en sus dos modos: rol, nombre (sólo alta), email, contraseña con mostrar/ocultar, validaciones, «Validando…», error de red, vista «Cuenta creada» y errores de ingreso (D5).
- [ ] **T4 — Shell por rol.** Header sin sesión («Ingresar» / «Crear cuenta») y con sesión (avatar y menú, D4), cierre de sesión real, redirección por rol, esqueletos de `/`, `/portfolio` y `/company` con protección, avatares en `apps/web/public/`. Ninguna página pública enlaza a `/admin`.
- [ ] **T5 — Documentación.** `README.md`, `docs/planning/DEMO.md`, `docs/design/demo-ui.md` (tabla pantalla → ruta en inglés), `docs/architecture/environments.md` y los textos de divulgación que decían «sin autenticación real».

## Pronóstico de entrega

Unas 1.500 líneas autoradas entre las cinco tareas, por encima del presupuesto de ~400 por PR. Estrategia elegida por el owner (2026-10-02): **`single-pr`** — una sola PR de #379 contra la rama de #378, con un commit por unidad de trabajo; las revisiones RDD se acotan por commit.

## Próximo paso

T2.
