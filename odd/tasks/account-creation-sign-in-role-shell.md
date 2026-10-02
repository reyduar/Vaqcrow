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
| D7 | Después del alta se muestra la vista «Conectá tu wallet» del template (fase `created` de `Vaqcrow Onboarding.dc.html`): aviso «Cuenta creada. Confirmá tu correo desde el enlace que te enviamos para poder ingresar.» con el rol y sin el email, la lista de próximos pasos del rol, «Conectar Freighter →» y «Volver al formulario». Si la cuenta no está confirmada, «Conectar Freighter» muestra «Antes de conectar Freighter, confirmá tu cuenta con el enlace que te enviamos a tu correo.»; la conexión real llega con #406/#426. |

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
  - Evaluación RDD tras T1: riesgo `medium`, `under_budget` (8 archivos, 266 líneas), queda pendiente en el tramo.
- [x] **T2 — Sesión en la web.** Puerto de sesión en `application/ports`, adaptador Supabase en `infrastructure/auth/`, store/provider por montaje en `state/`; el cliente HTTP manda `Authorization: Bearer` con el token vigente; variables `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` alineadas en preflight, generador del perfil docker y docs. Sin pantallas.
  - Ruta: delegada (writer acotado; más de dos archivos no triviales).
  - Librería: `@supabase/ssr` `0.12.7` (`createBrowserClient`) sobre `@supabase/supabase-js` `2.116.0` (la misma versión exacta que `apps/api`), ambas fijadas sin rango y con el lockfile. Por qué: es el cliente que la documentación de Supabase recomienda para Next.js App Router y guarda la sesión en cookies, así el gating del servidor (T4) puede leer la misma sesión; `supabase-js` solo la guardaría en `localStorage`, invisible para el servidor. Context7 (`/supabase/supabase`) confirmó las variables `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y que `AuthError` expone `code`/`status` estables (`invalid_credentials`, `email_not_confirmed`, `user_already_exists`).
  - Puerto (`auth-session-port.ts`): `signUp({ role, displayName, email, password, emailRedirectTo? }) → { status: 'confirmation_required' | 'signed_in' }`, `signIn({ email, password }) → { role, displayName }`, `signOut()`, `getSession() → signed-out | signed-in + principal`, `getAccessToken() → string | null` (nunca rechaza), `onSessionChange(listener) → unsubscribe`. Errores: `AuthSessionError` con sólo `code` ∈ `invalid_credentials`, `email_not_confirmed`, `email_taken`, `weak_password`, `invalid_input`, `rate_limited`, `network`, `unavailable`.
  - Diseño:
    - El rol y el nombre salen siempre de `public.profile` (`select role, display_name … eq user_id … maybeSingle`) con el JWT del propio usuario (`profile_select_own`); nunca de claims ni del formulario. El email y la sesión del proveedor no salen del adaptador; el principal es `{ role, displayName }`.
    - Un ingreso con sesión pero sin perfil legible falla como `unavailable` y descarta la sesión local (`signOut({ scope: 'local' })`), para no dejar una sesión a medias.
    - `email_taken` sólo cuando Supabase lo dice (`user_already_exists`/`email_exists`): con la confirmación de email activa, Supabase oculta a propósito las cuentas existentes; no se intenta deducirlo (evita enumerar cuentas).
    - `onSessionChange` difiere el aviso con `setTimeout(0)`: llamar a Supabase dentro del callback de `onAuthStateChange` puede bloquear el lock de auth. El aviso no lleva datos; el store relee `getSession()`.
    - Validación previa compartida (`application/auth/sign-up-input.ts`): rol `PYME`/`INVERSOR` (nunca `ADMIN`), nombre 2–120 caracteres tras trim (espejo del trigger de T1 y del `check` de la columna), email con `@`, contraseña no vacía → `invalid_input` sin llamar al proveedor. T3 la puede reutilizar.
    - Store `state/session-store.ts` + `session-store-provider.tsx` con el patrón de `journey-store` (`zustand/vanilla` + `useState(() => createSessionStore(port))`, sin singleton): `status: loading | signed-out | signed-in`, `principal`, `error` de la última lectura; acciones `refresh`, `signIn`, `signUp`, `signOut` que devuelven `{ ok: true, … } | { ok: false, code }`. Un contador de tickets descarta lecturas viejas que resuelven después de una acción nueva. El provider recibe el puerto por prop; **no se montó en el layout** (lo hace T4).
    - `createBrowserAuthSession()` (`infrastructure/auth/browser-auth-session.ts`) lee las dos variables con acceso literal a `process.env` y falla con `SupabaseConfigError` nombrando las variables faltantes, nunca sus valores. El puente explícito al cliente evita `TS2589` (instanciación de tipos demasiado profunda) al asignar el cliente genérico a la interfaz estructural.
    - `AxiosHttpClient` acepta un `accessToken` opcional (`() => Promise<string | null>`) en el constructor y en `create()`: lo resuelve en cada request y manda `Authorization: Bearer` sólo con un token RFC 6750 válido; sin token, token malformado (espacios, CR/LF) o proveedor que falla → sin header (la API responde 401). Los gateways del recorrido de seis pasos no se recablearon (#438 los retira).
    - Doble de pruebas: `src/test/fake-auth-session.ts` (`FakeAuthSession`), en memoria, con `seedAccount`, `failNext`, `holdNextGetSession`, `confirmSignUpsImmediately` y `listenerCount`.
    - Variables: `REQUIRED_WEB_ENV` del preflight suma las dos (espejo de `readSupabaseBrowserConfig`); `generate-docker-env.sh` las escribe desde `supabase status` (URL del host y clave publicable, nunca la `service_role`); `docs/architecture/environments.md` §1 y §13.4.
  - Archivos: `apps/web/package.json`, `pnpm-lock.yaml`, `apps/web/src/application/ports/auth-session-port.ts`, `apps/web/src/application/auth/sign-up-input{,.test}.ts`, `apps/web/src/infrastructure/auth/{supabase-auth-errors,supabase-auth-session,browser-auth-session}{,.test}.ts`, `apps/web/src/infrastructure/http/axios-http-client{,.test}.ts`, `apps/web/src/state/session-store{.ts,.test.ts}`, `apps/web/src/state/session-store-provider{.tsx,.test.tsx}`, `apps/web/src/test/fake-auth-session.ts`, `scripts/demo/preflight/preflight.mjs`, `tests/demo-preflight.test.ts`, `scripts/env/generate-docker-env.sh`, `docs/architecture/environments.md`.
  - RED (`pnpm --filter @vaqcrow/web exec vitest run src/application/auth src/infrastructure/auth src/state/session-store src/infrastructure/http/axios-http-client.test.ts`): 6 archivos fallan — cinco por `Failed to resolve import` (`./sign-up-input`, `./supabase-auth-errors`, `./supabase-auth-session`, `./session-store`, `./session-store-provider`) y `axios-http-client.test.ts` con 2 fallos (`expected undefined to deeply equal { Authorization: 'Bearer token-one' }` / `'Bearer jwt'`).
  - GREEN (mismo comando + `browser-auth-session.test.ts`): `Test Files 7 passed (7)`, `Tests 104 passed (104)`.
  - Verificación:
    - `pnpm --filter @vaqcrow/web typecheck`: sin errores (tras el puente explícito que resolvió `TS2589`).
    - `pnpm --filter @vaqcrow/web lint`: 0 errores, 1 warning previo (`fetch-http-client.ts` `_request`), ajeno a T2.
    - `pnpm run boundaries`: `no dependency violations found (582 modules, 1899 dependencies cruised)`.
    - `pnpm exec vitest run tests/demo-preflight.test.ts tests/config-secret-boundaries.test.ts`: `2 passed`, `63 passed`.
    - `pnpm --filter @vaqcrow/web test`: dos corridas completas con timeouts de jsdom bajo carga en archivos que T2 no toca (1.ª: `demo-step-loading.test.tsx`; 2.ª: `layout.traversal.test.tsx` y `theme-switcher.test.tsx`, `Test timed out in 5000ms`), 1013–1014 de 1015 en verde; los tres archivos aislados pasan (`3 passed`, `10 passed`).
  - Pendiente fuera de la superficie: las plantillas `.env.cloud.example` / `.env.docker.example` deben listar las dos variables vacías, pero la regla global `deny` impide a las sesiones de agente leer o editar `.env*`; queda para la persona operadora (o T5). `docs/planning/demo-run-preflight.md` (§ variables de Vercel y nota de `env-web`) y `docs/architecture/deploy-planning.md` §7 (tabla de Vercel) todavía nombran sólo `NEXT_PUBLIC_API_BASE_URL`: se alinean en T5.
  - Tamaño: ~1.200 líneas autoradas, unas 700 de tests más 138 del doble de pruebas; supera la heurística de ~400 porque puerto, adaptador, store y doble sólo tienen sentido juntos para T3/T4.
  - Commit: `feat(web): add the Supabase session port, adapter and per-mount store`.
  - Revisión RDD de T1+T2 (2026-10-02): base `8688136`, sólo commits, riesgo `high` (30 archivos, 1.803 líneas); el owner eligió «Revisar este cambio»; cuatro lentes sin bloqueantes → `approved`, linaje `review-98e5d0fa138c2a14`, autoridad `burned`. Consultivos: 3 `WARNING` sobre `session-store.ts` (acción fallida deja `loading`; refresco transitorio desloguea) → corregidos en T3; 6 `SUGGESTION`.
  - Pendiente del operador: agregar `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` a `.env.docker.example` / `.env.cloud.example` (los agentes no pueden editar `.env*`).
- [x] **T3 — `/signup` y `/login`.** La pantalla del template en sus dos modos: rol, nombre (sólo alta), email, contraseña con mostrar/ocultar, validaciones, «Validando…», error de red, vista «Cuenta creada» y errores de ingreso (D5).
  - Ruta: delegada (writer acotado; más de dos archivos no triviales).
  - **Unidad 1 — consultivos de la revisión sobre `session-store.ts`.**
    - RED (`pnpm --filter @vaqcrow/web exec vitest run src/state/session-store.test.ts`): 4 fallos de 18 — «a failed signIn/signOut during the initial read never strands loading» (`expected { status: 'loading' … } to match object { status: 'signed-out' … }`) y «a transient network/unavailable refresh failure keeps the signed-in principal» (`expected { status: 'signed-out' … } to match object { status: 'signed-in' … }`).
    - Diseño: una acción fallida (`signIn`/`signOut`) ya tomó un ticket y descarta la lectura inicial en vuelo; si el store sigue en `loading` y esa acción es la última, relee la sesión (`settleAfterFailedAction`) y queda en un estado definido. Una lectura fallida con el store en `signed-in` conserva el principal y registra `error`; sólo un snapshot `signed-out` explícito cierra la sesión del store.
    - GREEN (mismo comando + `session-store-provider.test.tsx`): `Test Files 2 passed (2)`, `Tests 24 passed (24)`.
    - Commit: `fix(web): keep the session store from stranding loading or signing out on transient errors` (`a4e962b`).
  - **Unidad 2 — pantallas `/signup` y `/login`.**
    - Rutas: grupo `app/(auth)/` fuera de `(demo)`, con `layout.tsx` que monta `BrowserSessionProvider` (puerto Supabase por montaje, nunca singleton). `signup/page.tsx` y `login/page.tsx` son componentes de servidor que leen `?role=investor|pyme` (`await searchParams`) y renderizan `AuthScreen` en el modo que corresponde; sin parámetro o con un valor desconocido, inversor (el default del template). Ambas rutas quedan dinámicas (`ƒ`) en el build.
    - Modelo sin React (`application/auth/auth-form.ts`): copy por rol y por modo, validación (`validateAuthForm`: nombre ≥ 2 tras trim sólo en alta, el regex de email del template, contraseña ≥ 8 en ambos modos como en el template), mensajes por código de error (`authErrorMessage`), `roleFromParam`/`authHref` (el link de cambio de modo conserva el rol) y `homeRouteFor` (D2: `INVERSOR` → `/portfolio`, `PYME` → `/company`, `ADMIN` → `/`).
    - Presentación: `auth-screen.tsx` (estado y envío), `auth-hero-panel.tsx` (panel violeta, pasos 01–04, chips con copy canónico `microcopy.testnetBadge` y el título de `non-custody`), `role-selector.tsx` (`radiogroup` con `aria-checked`, tabindex itinerante y flechas), `auth-field.tsx` (campo con ícono, `aria-invalid`, `aria-describedby` sólo hacia el error visible y la ayuda) y `account-created-panel.tsx` (fase `created`, D7). Isotipo copiado a `apps/web/public/vaqcrow-isotipo.png` y usado como máscara, como en el template. El pie «No apto para producción» sale de la divulgación canónica `no-production`.
    - Comportamiento: errores de campo sólo después del primer envío (foco al primer campo inválido); «Validando…» con botón e inputs deshabilitados y la región `aria-live` «Validando tus datos. No cierres esta ventana.»; en reposo la región muestra «Demo en Stellar Testnet: los activos no tienen valor económico.» (D5). El ingreso redirige con `router.push` según el rol que devuelve el puerto, nunca según el selector. El alta manda el nombre recortado y `emailRedirectTo = ${window.location.origin}/login`; con `confirmation_required` muestra «Conectá tu wallet» con el aviso, el rol y los próximos pasos del rol (íconos y etiquetas del template), limpia la contraseña y mueve el foco al título; «Conectar Freighter» muestra (con `role="status"`) «Antes de conectar Freighter, confirmá tu cuenta con el enlace que te enviamos a tu correo.»; con `signed_in` relee la sesión y redirige por el rol verificado. El email no se muestra nunca fuera de su input.
    - Puerto perezoso (`infrastructure/auth/lazy-auth-session.ts`): el `useState` del provider también corre en el render del servidor y `createBrowserAuthSession()` lanza si faltan las variables `NEXT_PUBLIC_SUPABASE_*`; el puerto se construye en la primera llamada (en un efecto del cliente) y una configuración faltante se vuelve `unavailable` saneado, `getAccessToken` → `null` y `onSessionChange` no-op.
    - Desvíos registrados: (1) el campo usa elementos nativos con `label htmlFor` en vez del `<label>` envolvente del template, que metería el error y el botón del ojo en el nombre accesible, y en vez del primitivo HeroUI `TextField`, que no tiene ranura de ícono inicial ni de control interno; (2) el selector de tema reutiliza `ThemeSwitcher` (radiogroup «Tema», desvío ya registrado en ese componente) en lugar de los tres botones con `aria-pressed`; (3) el botón mostrar/ocultar mide 44 px (el template, 40 px) para cumplir el área táctil mínima.
    - Supuestos para el owner (copy nuevo, fuera del template y de D5):
      - Ingreso, otros códigos (`unavailable`, `rate_limited`, …): «No pudimos ingresar. Volvé a intentar en unos minutos.». `invalid_input` en el ingreso reutiliza «Correo o contraseña incorrectos.».
      - Alta `email_taken`: «No pudimos crear la cuenta. Ese correo ya tiene una cuenta: ingresá o usá otro correo.» (sólo aparece cuando Supabase lo dice explícitamente; con confirmación activa lo oculta).
      - Alta `weak_password`: «No pudimos crear la cuenta. Elegí una contraseña más difícil de adivinar.».
      - Alta `invalid_input`: «No pudimos crear la cuenta. Revisá los datos e intentá de nuevo.»; otros códigos: «No pudimos crear la cuenta. Volvé a intentar en unos minutos.».
      - Vista «Conectá tu wallet» para la PyME: el template titula «Registrá tu PyME» con «Continuar con el KYC simulado»; por D7 ambas usan «Conectá tu wallet», «Conectar Freighter →» y el cuerpo del inversor («Freighter firma cada transacción. Vaqcrow construye y verifica la transacción, y nunca recibe tu seed.»); la lista de pasos sigue siendo la del rol.
      - `ADMIN` que ingresa por `/login` va a `/` (la consola `/admin` está fuera del alcance de #379).
      - Lista de pasos con nombre accesible «Próximos pasos» (`aria-label`, no visible).
    - Fuera del alcance: una persona ya logueada que abre `/login` o `/signup` no se redirige (lo resuelve la protección por sesión de T4).
    - RED: `pnpm --filter @vaqcrow/web exec vitest run src/application/auth/auth-form.test.ts src/presentation/components/auth-screen.test.tsx` → `Failed to resolve import "./auth-form"` / `"./auth-screen"`; `… src/infrastructure/auth/lazy-auth-session.test.ts "src/app/(auth)"` → `Failed to resolve import "./lazy-auth-session"` / `"./login/page"`. Un primer GREEN dejó 1 fallo real («sends the trimmed name…»: la pantalla mandaba el nombre sin recortar) → la pantalla recorta antes de llamar al puerto.
    - GREEN (focalizado: `auth-form`, `auth-screen`, `lazy-auth-session`, `(auth)` y `session-store*`): `Test Files 7 passed (7)`, `Tests 104 passed (104)`. Una corrida fría tuvo un fallo intermitente en «a INVERSOR signup shows the created view» que no se reprodujo en 10 corridas; la aserción del foco pasó a `waitFor` sobre el título.
    - Verificación:
      - `pnpm --filter @vaqcrow/web test`: `Test Files 124 passed (124)`, `Tests 1087 passed (1087)`.
      - `pnpm --filter @vaqcrow/web lint`: 0 errores, 1 warning previo (`fetch-http-client.ts` `_request`).
      - `pnpm --filter @vaqcrow/web typecheck`: sin errores.
      - `pnpm --filter @vaqcrow/web build`: compila; `/login` y `/signup` dinámicas (`ƒ`).
      - `pnpm run boundaries`: `no dependency violations found (602 modules, 1970 dependencies cruised)`.
      - Arnés de ejecución: `next start -p 3999` sin variables de Supabase; `curl /login?role=pyme` devuelve «Ingresá a tu cuenta» con el héroe PyME y `curl /signup` «Creá tu cuenta» con el héroe inversor (el puerto perezoso evita el error de configuración en el servidor).
    - Tamaño: ~1.580 líneas nuevas (unas 560 de tests); supera la heurística de ~400 porque la pantalla del template, sus dos modos y la vista creada son una sola unidad.
    - Commit: `feat(web): add the sign-up and sign-in screens`.
- [ ] **T4 — Shell por rol.** Header sin sesión («Ingresar» / «Crear cuenta») y con sesión (avatar y menú, D4), cierre de sesión real, redirección por rol, esqueletos de `/`, `/portfolio` y `/company` con protección, avatares en `apps/web/public/`. Ninguna página pública enlaza a `/admin`.
- [ ] **T5 — Documentación.** `README.md`, `docs/planning/DEMO.md`, `docs/design/demo-ui.md` (tabla pantalla → ruta en inglés), `docs/architecture/environments.md` y los textos de divulgación que decían «sin autenticación real».

## Pronóstico de entrega

Unas 1.500 líneas autoradas entre las cinco tareas, por encima del presupuesto de ~400 por PR. Estrategia elegida por el owner (2026-10-02): **`single-pr`** — una sola PR de #379 contra la rama de #378, con un commit por unidad de trabajo; las revisiones RDD se acotan por commit.

## Próximo paso

T4.
