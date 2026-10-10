# Evidencia de cierre de la Feature #378 — Issue #381

> Documento de cierre de Feature. Consolida la evidencia de las Tasks [#379](https://github.com/reyduar/Vaqcrow/issues/379) (implementación) y [#380](https://github.com/reyduar/Vaqcrow/issues/380) (pruebas) de la Feature [#378](https://github.com/reyduar/Vaqcrow/issues/378) ("Feature: Provide account creation, sign-in and a role-aware shell", Epic [#368](https://github.com/reyduar/Vaqcrow/issues/368)), re-ejecuta las verificaciones locales en este árbol de trabajo y mapea cada criterio de aceptación de la Feature, citado textualmente, a su resultado y a la fuente de ese resultado. La bitácora de iteración que lo alimenta es [[odd/tasks/account-creation-sign-in-role-shell|Bitácora: creación de cuentas, ingreso y shell según el rol]].

> [!warning] Estado de entrega: nada de #369 ni de #378 está en `main`
> Las PRs [#446](https://github.com/reyduar/Vaqcrow/pull/446) (#379) y [#447](https://github.com/reyduar/Vaqcrow/pull/447) (#380) están mergeadas en la **rama de la Feature** `Vaqcrow#378_Feat_Provide_account_creation_sign_in_and_a_role_aware_shell`, que a su vez se creó desde la rama de la Feature #369 (`8688136`), no en `main`. Por decisión del owner, #369 y #378 llegan **juntas** a `main`, junto con el retiro del recorrido de seis pasos ([#438](https://github.com/reyduar/Vaqcrow/issues/438)). Verificado el 2026-10-03 con `git merge-base --is-ancestor`: ni `8688136` (base de la rama), ni `e6942af` (merge de #446), ni `3766b09` (merge de #447) son ancestros de `origin/main` (`aaee084`). La demo desplegada desde `main` sigue usando la sesión de demostración.

> [!info] 2026-10-10 — Mergeado en `main` vía [#466](https://github.com/reyduar/Vaqcrow/pull/466) (merge `2b7e0d5`).

## 1. Contexto y objetivo

El issue [#381](https://github.com/reyduar/Vaqcrow/issues/381) ("Task: Document evidence for account creation, sign-in and the role-aware shell") es la tercera Task de la Feature #378. La Feature permite crear una cuenta `INVERSOR` o `PYME`, ingresar con Supabase Auth real y navegar un header que cambia según haya sesión y según el rol verificado, siguiendo `Vaqcrow Onboarding.dc.html` y el menú de avatar del template. Depende de #369 (Supabase Auth, roles, RLS y autorización de la API; evidencia en [[docs/planning/supabase-auth-roles-and-authorization-evidence|Evidencia de #369]]).

| Task | Rama | PR | Merge (en la rama de la Feature) | Estado del issue (2026-10-03) |
|---|---|---|---|---|
| #379 — implementar | `Vaqcrow#379_Task_Implement_account_creation_sign_in_and_the_role_aware_shell` | [#446](https://github.com/reyduar/Vaqcrow/pull/446) | `e6942af`, 2026-10-03 14:11 UTC | cerrado a mano el 2026-10-03 14:13 UTC, Project `Done` |
| #380 — probar | `Vaqcrow#380_Task_Test_account_creation_sign_in_and_the_role_aware_shell` | [#447](https://github.com/reyduar/Vaqcrow/pull/447) | `3766b09`, 2026-10-03 14:43 UTC | cerrado a mano el 2026-10-03 14:45 UTC, Project `Done` |
| #381 — documentar | `Vaqcrow#381_Task_Document_evidence_for_account_creation_sign_in_and_the_role_aware_shell` | — | — | este documento (Project `Backlog`) |

La Feature #378 sigue abierta (Project `In progress`, `subIssuesSummary` 2/3 al 2026-10-03); su cierre lo decide el owner.

## 2. Cómo leer esta evidencia

- **Tres fuentes, siempre nombradas.** (a) **Re-ejecutado** — un comando corrido el 2026-10-03 en este árbol de trabajo (rama de #381 sobre `3766b09`, Node `v24.21.0`), con su línea de salida real (§4.1). (b) **CI** — un run de GitHub Actions consultado con `gh pr checks` (§4.2). (c) **Bitácora** — una entrada fechada de la bitácora de iteración o de la descripción de la PR; se cita, **no** se re-ejecutó aquí.
- **Dobles, no proveedores.** Ninguna prueba de esta Feature habla con el proyecto Supabase remoto ni con Resend. Las pruebas de componentes usan `FakeAuthSession`; el smoke de Playwright usa un doble local de Supabase Auth/PostgREST (`apps/web/e2e/support/stub-supabase-server.mjs`) que firma tokens ES256 de verdad. Sólo `pnpm run test:db` toca una base, y es el stack local del perfil docker.
- **Sin secretos.** Ningún email, contraseña, clave, token ni identificador de proyecto aparece en este documento; las variables se nombran, nunca sus valores.

## 3. Qué quedó implementado (Task #379)

Fuente: bitácora (T1–T5, 2026-10-02/03) y lectura del código en `3766b09`.

- **Nombre visible obligatorio (T1)** — migración `supabase/migrations/20261002120000_require_signup_display_name.sql`: `handle_new_user()` rechaza con `22023` un alta `PYME`/`INVERSOR` sin `display_name` de al menos 2 caracteres tras `btrim` y deja de derivarlo del email; la promoción a `ADMIN` aplica la misma regla. Aplicada al remoto el 2026-10-02 (bitácora T1).
- **Sesión en la web (T2)** — `AuthSessionPort` (`apps/web/src/application/ports/auth-session-port.ts`) con errores saneados por `code`; adaptador `infrastructure/auth/supabase-auth-session.ts` sobre `@supabase/ssr` `0.12.7` (sesión en cookies); el rol y el nombre salen siempre de la fila propia de `public.profile` bajo RLS, nunca del formulario ni de claims; el email nunca sale del adaptador. Store por montaje `state/session-store.ts` + `presentation/components/` `BrowserSessionProvider` montado una vez en `app/layout.tsx` (sin singleton). `AxiosHttpClient` manda `Authorization: Bearer` sólo con un token válido. Variables `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en el preflight (`REQUIRED_WEB_ENV`) y en `generate-docker-env.sh`.
- **`/signup` y `/login` (T3)** — una pantalla del template con dos modos (`AuthScreen`): selector de rol `radiogroup`, «Nombre completo» / «Nombre o Razón Social» (sólo alta), email, contraseña con mostrar/ocultar, errores de campo tras el primer envío, «Validando…» con región `aria-live`, errores de red y de ingreso (D5), vista posterior al alta por rol (D7/D8). El ingreso redirige por el rol que devuelve el perfil (`INVERSOR` → `/portfolio`, `PYME` → `/company`), nunca por el selector.
- **Shell por rol (T4)** — `AppHeader` con `DEMO`/`TESTNET`, selector de tema de tres opciones y, sin sesión, «Ingresar» / «Crear cuenta»; con sesión, `AccountMenu` en variante `avatar` con los menús exactos de D9. «Cerrar sesión» cierra la sesión real y navega a `/`; si falla, se queda en la página y lo dice. Protección **en el servidor** con `apps/web/src/proxy.ts` (Next.js 16; `getClaims()` + perfil propio, acotado a 3 s, falla cerrado) y defensa en el cliente con `RouteGate`. `/`, `/portfolio` y `/company` son esqueletos con el título y el subtítulo del template.
- **Documentación (T5)** — `README.md`, `docs/planning/DEMO.md`, `docs/design/demo-ui.md` (rutas en inglés), `docs/architecture/environments.md`, `identity-and-rls-boundaries.md` §9.9, `demo-run-preflight.md`, `deploy-planning.md`; divulgación canónica reescrita (D10) en sus cuatro superficies.

## 4. Qué quedó probado

### 4.1 Re-ejecutado en este árbol de trabajo (2026-10-03)

Rama de #381 sobre `3766b09`, Node `v24.21.0`, base de datos del stack local del perfil docker en marcha (algunos servicios auxiliares del stack, como Storage y Studio, detenidos; `test:db` sólo usa Postgres).

```sh
$ pnpm --filter @vaqcrow/web test
 Test Files  131 passed (131)
      Tests  1204 passed (1204)

$ pnpm --filter @vaqcrow/web exec playwright test
  ✓ e2e/auth-roles.spec.ts › INVERSOR: create the account, confirm, sign in, sign out and sign back in
  ✓ e2e/auth-roles.spec.ts › PYME: create the account, confirm, sign in, sign out and sign back in
  ✓ e2e/auth-roles.spec.ts › a PyME visiting the investor portfolio is sent to its own home
  ✓ e2e/auth-roles.spec.ts › a signed-in visitor opening the sign-in page goes to their home
  ✓ e2e/auth-roles.spec.ts › wrong credentials are refused without signing in
  ✓ e2e/guided-journey.spec.ts › the root is the public landing skeleton, without a link to /admin
  37 passed (1.2m)

$ pnpm run test:db
/…/supabase/tests/admin_promotion.sql ...................... ok
/…/supabase/tests/admin_rls_scope.sql ...................... ok
/…/supabase/tests/identity_and_audit.sql ................... ok
(+ 6 archivos previos, todos ok)
All tests successful.
Files=9, Tests=173
Result: PASS

$ pnpm run boundaries
✔ no dependency violations found (628 modules, 2048 dependencies cruised)

$ pnpm run test:boundaries
 Test Files  10 passed (10)
      Tests  152 passed (152)

$ pnpm --filter @vaqcrow/web lint
✖ 1 problem (0 errors, 1 warning)   # warning previo: '_request' sin usar en fetch-http-client.ts
exit 0

$ pnpm --filter @vaqcrow/web typecheck
exit 0

$ pnpm --filter @vaqcrow/web build
┌ ○ /
├ ○ /company
├ ƒ /login
├ ○ /portfolio
└ ƒ /signup
ƒ Proxy (Middleware)
exit 0                               # (rutas del recorrido de seis pasos omitidas)
```

En esta corrida la suite web pasó completa en el primer intento, sin los timeouts de jsdom bajo carga que la bitácora registró en corridas anteriores. **No re-ejecutado:** `pnpm run verify` completo ni las suites de `apps/api`, `packages/*` (esta Feature no las cambia); su resultado de PR se toma del CI (§4.2).

### 4.2 CI de las PRs (consultado con `gh pr checks`, 2026-10-03)

| PR | Run | Job | Resultado |
|---|---|---|---|
| #446 | `37113991595` | Quality gates (lint, types, tests, build, boundaries) — `pnpm run verify` | pass |
| #446 | `37113991595` | Playwright (deterministic, local double) | pass |
| #446 | `37113991595` | Contracts (build, test, deploy on a local network) | pass |
| #446 | `37113991593` | Build Storybook (static) | pass |
| #447 | `37130344785` | Quality gates (lint, types, tests, build, boundaries) — `pnpm run verify` | pass |
| #447 | `37130344785` | Playwright (deterministic, local double) | pass |
| #447 | `37130344785` | Contracts (build, test, deploy on a local network) | pass |
| #447 | `37130344747` | Build Storybook (static) | pass |

El check «Vercel» de ambas PRs también figura `pass` (preview desplegado); este documento no inspeccionó esos previews.

### 4.3 Qué cubre cada suite

| Comportamiento | Prueba | Fuente del resultado |
|---|---|---|
| Alta: nombre recortado, vista creada por rol sin el email, errores de campo tras el primer envío, email inválido solo y contraseña corta sola con foco al campo, un único pedido aunque se reenvíe mientras valida, «Validando…» y región `aria-live`, error de red honesto | `apps/web/src/presentation/components/auth-screen.test.tsx`, `application/auth/auth-form.test.ts`, `sign-up-input.test.ts` | Re-ejecutado (suite web); RED en bitácora T3 y P2 (mutantes) |
| Ingreso: redirección por el rol verificado, `invalid_credentials`, `email_not_confirmed`, red | `auth-screen.test.tsx`, `infrastructure/auth/supabase-auth-session.test.ts`, `supabase-auth-errors.test.ts` | Re-ejecutado |
| Store de sesión: sin quedar en `loading`, error transitorio no desloguea, `signedOutByUser` | `state/session-store.test.ts`, `session-store-provider.test.tsx` | Re-ejecutado; RED en bitácora T3 unidad 1 y T4 unidad A |
| Header y menú por rol (sin sesión, cargando, `INVERSOR`, `PYME`, `ADMIN`), ítems de D9, sin email, `DEMO`/`TESTNET` | `presentation/components/app-header.test.tsx`, `account-menu.test.tsx`, `application/navigation/shell-nav.test.ts` | Re-ejecutado |
| Teclado del menú: Escape (devuelve el foco), clic afuera, foco al primer ítem al abrir, flechas/Home/End con vuelta, Tab fuera lo cierra | `account-menu.test.tsx`, `app-header.test.tsx` | Re-ejecutado; RED en bitácora P2 (defecto real corregido en `account-menu.tsx`) |
| Cierre de sesión fallido: se queda en la página con aviso | `app-header.test.tsx` | Re-ejecutado; RED en bitácora T4 unidad A |
| Guardas: anónimo → `/login?role=…`, rol equivocado → su home, sesión abierta en `/login`/`/signup` → su home; proxy con timeout, log saneado y cookies tardías descartadas | `application/auth/route-gate.test.ts`, `presentation/components/route-gate.test.tsx`, `src/proxy.test.ts`, `infrastructure/auth/server-session.test.ts` | Re-ejecutado; RED en bitácora T4 y unidad B |
| Smoke por rol en el navegador: alta → vista creada → ingreso sin confirmar rechazado → confirmar → ingreso → home del rol con la navegación de D9 → menú sin email → «Cerrar sesión» → `/` → la página protegida redirige → volver a ingresar; PyME en `/portfolio` → `/company`; sesión abierta en `/login` → home; credenciales incorrectas | `apps/web/e2e/auth-roles.spec.ts` contra el doble `stub-supabase-server.mjs` | Re-ejecutado (Playwright); RED por mutante en bitácora P3 |
| `/` es un esqueleto público sin link a `/admin` | `apps/web/e2e/guided-journey.spec.ts`, `src/app/page.test.tsx` | Re-ejecutado |
| Alta sin nombre visible válido falla con `22023` y no deja perfil | `supabase/tests/identity_and_audit.sql`, `admin_promotion.sql` | Re-ejecutado (`test:db`) |
| Divulgación canónica igual en código y documentos | `tests/trust-disclosures-canonical-consistency.test.ts` | Re-ejecutado (`test:boundaries`) |

### 4.4 Verificaciones fuera del gate de PR (tomadas de la bitácora, no re-ejecutadas)

- **Remoto (MCP de Supabase, 2026-10-02):** migración `20261002120000` aplicada con versión de historial alineada; funciones `security definer` con `search_path=""`, sin EXECUTE para `anon`/`authenticated`, sin derivar el nombre del email. Advisor de seguridad: el INFO esperado `rls_enabled_no_policy` y un `WARN` `auth_leaked_password_protection` (opción del panel de Auth; decisión del owner).
- **Arnés `next start` sin variables de Supabase (T3, T4):** `/portfolio` 307 a `/login?role=investor`, `/company` 307 a `/login?role=pyme`, `/login`, `/signup` y `/` 200; el HTML de `/` sin links a `/admin`.
- **Variables web en Vercel y `.env.cloud`:** el owner las cargó el 2026-10-03 (bitácora «Entrega de #379»); ningún agente lo verificó.

**Nunca ejercitado:** alta, confirmación, ingreso, cierre de sesión ni redirección por rol desde la web contra el proyecto Supabase **remoto** ni contra el GoTrue local; todo eso está probado contra dobles (Vitest y Playwright). La entrega real del email de confirmación por Resend tampoco se observó.

## 5. Límites y brechas vigentes

1. **Sin comprobación contra el remoto.** El primer alta real contra el proyecto remoto (que además observaría la entrega de Resend) está pendiente; el doble de Playwright reproduce el contrato de GoTrue/PostgREST que lee `@supabase/auth-js` 2.116.0, no el servicio.
2. **R1-002 — propiedad por fila.** Las rutas `PYME` de la API verifican el rol pero no que la fila sea de quien llama; llega con [#398](https://github.com/reyduar/Vaqcrow/issues/398). **Condición de entrega:** se resuelve o el owner lo acepta explícitamente antes del merge a `main` de #369 + #378.
3. **Links a páginas que todavía no existen.** Los menús de D9 enlazan `/explore`, `/about`, `/entrepreneur-guide`, `/investor-guide`, `/reports` y `/#how-it-works`; hoy responden 404 o no tienen ancla. El owner lo aceptó hasta [#414](https://github.com/reyduar/Vaqcrow/issues/414), [#394](https://github.com/reyduar/Vaqcrow/issues/394), [#430](https://github.com/reyduar/Vaqcrow/issues/430) y [#418](https://github.com/reyduar/Vaqcrow/issues/418).
4. **Esqueletos.** `/`, `/portfolio` y `/company` sólo tienen header, título y subtítulo; el contenido llega con [#418](https://github.com/reyduar/Vaqcrow/issues/418), [#426](https://github.com/reyduar/Vaqcrow/issues/426) y [#434](https://github.com/reyduar/Vaqcrow/issues/434). «Registrar mi PyME» se ve inactivo (`aria-disabled`) hasta que #398 cablee el wizard.
5. **Gating acotado a lo que existe.** El proxy protege `/portfolio` y `/company` (y redirige la sesión abierta en `/login`/`/signup`). Las otras pantallas que el template protege («Ingresá para ver esta campaña», «Ingresá para ver tus informes») no existen todavía; su protección llega con sus Features.
6. **`.env.docker.example` sin las variables web de Supabase.** Los agentes no pueden editar `.env*`; queda como pendiente del operador. `.env.cloud.example` ya las tiene (`5eac715`) y no lleva el bloque del superadmin (D11).
7. **El recorrido de seis pasos sigue sin token.** Sus gateways no mandan `Authorization` y siguen mandando `actor`; se retiran con #438 en la misma entrega a `main`.
8. **Leaked password protection.** El `WARN` del advisor de Supabase queda como decisión del owner.
9. **Accesibilidad sin auditoría automatizada.** No hay `axe` ni medición de contraste en las suites; ver criterio 5 (§8).

## 6. Preguntas abiertas y decisiones del owner

| Pregunta (issue #378, «Not designed in the template (open question)») | Resolución | Fuente |
|---|---|---|
| "A public "Ingresar" login page. The template's header "Ingresar" only opens a demo role-pick menu ("Sesión de demostración": "Ingresar como inversor" / "Ingresar como PyME"), and the "Ingresá para ver ..." gate screens reuse that menu. The owner wants a Login page; its layout, error states, password-reset link and email-verification step are not designed." | `/login` es el modo «Ingresá a tu cuenta» de la misma pantalla de `Vaqcrow Onboarding.dc.html` (template refrescado el 2026-10-02); errores de ingreso con el copy de D5; el paso de verificación es la vista posterior al alta (D7/D8) y el error «Todavía no confirmaste tu correo…»; **sin enlace de recuperación de contraseña** (diferida desde #369, D2 de esa Feature). Rutas en inglés (D1) y redirección por rol verificado (D2). | Bitácora D1, D2, D5, D7, D8; comentario del owner en #378 (2026-10-02) |
| "Copy that says "Sin autenticación real: es una cuenta de demostración." and "Cuenta de demostración creada." is no longer true with real authentication; replacement copy is not designed." | Reemplazos de D5 («Cuenta creada. Confirmá tu correo…», «Demo en Stellar Testnet: los activos no tienen valor económico.») y nuevo primer aviso canónico de D10 («Las cuentas son reales, pero no representan una verificación de identidad ni movimientos de dinero real.»). | Bitácora D5, D10 (owner, 2026-10-02/03) |
| "Where the display name shown in the avatar menu ("Lucía Fernández", "Panadería Horizonte SRL") comes from: account creation only collects email, password and role." | El alta exige «Nombre completo» (inversor) o «Nombre o Razón Social» (PyME), mínimo 2 caracteres, guardado como `display_name` y exigido por el trigger (T1); el email no se muestra nunca. | Bitácora D3, T1 |

Decisiones del owner registradas durante la Feature (bitácora, 2026-10-02/03), con las que reemplazan a otras:

| # | Decisión | Estado |
|---|---|---|
| D1 | Rutas siempre en inglés: `/`, `/signup`, `/login`, `/portfolio`, `/company`. | vigente |
| D2 | El ingreso redirige por el rol del perfil verificado; el selector del ingreso sólo cambia textos. | vigente; la parte del selector la reemplaza D14 (2026-10-03, ver addendum) |
| D3 | Nombre visible obligatorio (≥ 2 caracteres); el email nunca se muestra. | vigente |
| D4 | Menús del avatar por rol con «Centro de ayuda». | **reemplazada por D9** |
| D5 | Copy de reemplazo de la cuenta de demostración y de los errores de ingreso. | vigente |
| D6 | `/`, `/portfolio`, `/company` como esqueletos protegidos; el recorrido de seis pasos no se toca. | vigente |
| D7 | Vista «Conectá tu wallet» tras el alta. | **acotada por D8** al inversor |
| D8 | Vista posterior al alta por rol; la PyME ve «Registrá tu PyME» y conecta Freighter en la Revisión humana del wizard, no acá. | vigente |
| D9 | Menús exactos del shell (sin «Centro de ayuda»), links a páginas futuras aceptados con 404, `/company` con «Registrar mi PyME» y **sin popup de wallet**, ningún link público a `/admin`. | vigente |
| D10 | Nuevo texto del primer aviso canónico («Demostración con datos simulados…»). | vigente |
| D11 | `.env.cloud.example` sin el bloque `VAQCROW_SUPERADMIN_*`; `.env.docker.example` conserva sus dos líneas vacías. | vigente |

**Supuestos de copy no diseñado** (registrados en la bitácora como «supuestos para el owner»; **aprobados tal cual por el owner el 2026-10-03**, D13): mensajes de ingreso para `unavailable`/`rate_limited`, alta `email_taken`/`weak_password`/`invalid_input`, la variante honesta del error de red del alta (reemplaza «…tus datos no se enviaron…» del template, porque el puerto no sabe si el pedido llegó), «Cuenta creada. No pudimos abrir tu sesión…», «No pudimos cerrar la sesión. Volvé a intentar.», `ADMIN` en el sitio público (chip, iniciales y sólo «Cerrar sesión»; `/login` → `/`), «Registrar mi PyME» inactivo hasta #398 y el nombre accesible «Próximos pasos».

## 7. Correcciones aplicadas durante el ciclo

1. **Store que quedaba en `loading` o deslogueaba ante un error transitorio** (revisión de T1+T2) → `a4e962b`.
2. **Hallazgos de la revisión de T3** (prop `confirmed` muerta, pie cortado por offset, alta `signed_in` sin sesión legible, copy de red engañoso) → `6553dbd`.
3. **Hallazgos de la revisión de T4** (cierre de sesión fallido, carrera del guard, redirecciones de ida y vuelta, lectura del proxy sin cota) → `859ee81`.
4. **Hallazgos de la revisión del último tramo** (guard en blanco tras cerrar sesión, cookies renovadas que llegaban tarde) → `2ffd7ae`; plantilla del superadmin resuelta por D11 (`fe09e50`).
5. **Guarda de consistencia de divulgaciones apagada** por la regresión de `6553dbd` (contaba cero textos y pasaba vacía) → `e40177f`.
6. **Menú de avatar sin foco ni teclado** (`role="menu"` sin foco al abrir, sin flechas, Tab no cerraba) → corregido en #380 (`1760bd1`).

Revisiones RDD:

| Candidato | Linaje | Resultado | Fuente |
|---|---|---|---|
| T1+T2 (base `8688136`, `high`, 30 archivos) | `review-98e5d0fa138c2a14` | `approved`, sin bloqueantes; 3 `WARNING` corregidos en T3 | Bitácora |
| T3 (base `91dbe29`, `high`, 19 archivos) | `review-4a6401177f91e285` | `approved`; 4 `WARNING` corregidos en `6553dbd` | Bitácora |
| T4 (base `55e4f96`, `high`, 41 archivos) | `review-98e83291545aff3d` | `approved`; 4 `WARNING` corregidos en `859ee81` | Bitácora |
| Último tramo (base `aab98c6`, `high`, 28 archivos) | `review-7f2d388c22ce7ced` | `approved`; `WARNING` corregidos en `2ffd7ae` / D11 | Bitácora |
| Correcciones finales | `review-be5686dd920f0b8a` | `approved`, sin bloqueantes | Descripción de la PR #446 (la bitácora no registra su detalle) |
| #380 (base `e6942af`, sólo commits, `high`, 10 archivos, 678 líneas) | — | el owner eligió «Omitir esta vez» (`declined_this_candidate`): sin revisión | Bitácora (2026-10-03) |

## 8. Mapeo de criterios de aceptación

| # | Criterio (verbatim, issue #378) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Create-account flow matches the Onboarding screen, including role selection, validation messages, busy state and network-error state, backed by real Supabase Auth." | ⚠️ **PARCIAL — cumplido con dobles; pendiente la comprobación contra el remoto.** La pantalla sigue `Vaqcrow Onboarding.dc.html` con selector de rol, mensajes de validación, «Validando…» y error de red, probados en componentes y en el smoke por rol. El adaptador usa `@supabase/ssr`/`supabase-js` reales, pero el flujo web sólo corrió contra `FakeAuthSession` y contra el doble local de Playwright, nunca contra Supabase Auth (ni el GoTrue local ni el remoto). Desvío: el texto del error de red es la variante honesta (§6), no el del template. | Suite web y Playwright re-ejecutados; bitácora T3 |
| 2 | "The header and avatar dropdown show the role-specific items quoted above and `DEMO`/`TESTNET`; Escape and outside click close the dropdown." | ✅ **CUMPLIDO según D9.** Los ítems «quoted above» del issue fueron reemplazados por la decisión D9 del owner (sin «Centro de ayuda»; «Guía del inversor» / «Guía del emprendedor»); el header y el menú muestran exactamente los de D9 con `DEMO`/`TESTNET`; Escape y clic afuera cierran, más foco y flechas (P2). | Suite web y Playwright re-ejecutados |
| 3 | "Sign-out ends the real session; gated pages redirect unauthenticated users." | ⚠️ **CUMPLIDO con dobles; pendiente la comprobación contra el remoto.** «Cerrar sesión» llama a `signOut()` de Supabase y el smoke prueba que después `/portfolio`/`/company` redirigen a `/login?role=…`; proxy en el servidor y `RouteGate` en el cliente. Sólo existen hoy las páginas protegidas `/portfolio` y `/company` (§5.5). | Suite web y Playwright re-ejecutados; bitácora P3 (mutante) |
| 4 | "No public page links to `/admin`." | ✅ **CUMPLIDO** — test e2e «the root is the public landing skeleton, without a link to /admin»; `ADMIN` en el sitio público no recibe link a `/admin`; `rg -n "/admin" apps/web/src/presentation apps/web/src/app` (sin tests ni stories) → 0 coincidencias. | Playwright re-ejecutado; `rg` re-ejecutado |
| 5 | "Accessibility behaviors of the template (focus ring, 44 px targets, ARIA states, reduced motion) are present." | ⚠️ **PARCIAL** — los estados ARIA (`radiogroup`/`aria-checked`, `aria-expanded`, `aria-invalid`, `aria-current`, `aria-live`) y el teclado del menú están probados; el anillo de foco, los 44 px (el ojo de la contraseña mide 44 px, el template 40 px) y `prefers-reduced-motion` están en el código (`globals.css` `@media (prefers-reduced-motion: reduce)`, `focus-visible` en `auth-field.tsx`, `app-header.tsx` y `account-menu.tsx`, segmentos de 44 px en `role-selector.tsx` y `account-menu.tsx`), pero **ninguna prueba los afirma**, y el contraste AA no se midió (sin `axe`). | Suite web re-ejecutada; lectura del código con `rg` (2026-10-03) |
| 6 | "Required evidence and failure behavior are covered." | ✅ **CUMPLIDO** — fallos cubiertos: red y `unavailable` en alta e ingreso, cuenta sin confirmar, credenciales incorrectas, perfil ilegible (descarta la sesión), configuración faltante (puerto perezoso → `unavailable`), proxy lento (3 s, falla cerrado, log saneado), cookies tardías descartadas, cierre de sesión fallido; este documento es la evidencia. | Suite web re-ejecutada; §4.3 |
| 7 | "Every item under "Not designed in the template (open question)" is decided by the owner before it is implemented; none is invented." | ✅ **CUMPLIDO.** Las tres preguntas se decidieron (D1–D11, §6) antes de implementarse. Los textos no diseñados que la implementación necesitó quedaron listados como supuestos para el owner (§6), y el owner los aprobó tal cual el 2026-10-03 (D13). | Bitácora D1–D13 y supuestos de T3/T4 |
| 8 | "No unsupported production claims or secrets are introduced." | ✅ **CUMPLIDO** — sin valores de variables en el repositorio, la bitácora ni este documento (la clave del doble de Playwright es un literal falso `sb_publishable_e2e-local-double-not-a-real-key`); el email nunca se muestra en la UI; la divulgación sigue declarando la demo como no productiva (D10). | Revisión de este documento; Playwright re-ejecutado (sin email en la página) |

## 9. Riesgos, contradicciones y limitaciones aceptadas

- **Cierre manual de las Tasks.** GitHub no cierra un issue cuando la PR se mergea en una rama que no es la principal: #379 y #380 se cerraron a mano el 2026-10-03 y el Project los muestra en `Done`. Ninguno está en `main`.
- **#380 sin revisión RDD.** El owner declinó la revisión de ese candidato; su verificación es la de la bitácora P1–P3 y la re-ejecución de §4.1.
- **El remoto no se re-verificó aquí.** Todo lo del proyecto remoto proviene de la bitácora (2026-10-02/03).
- **Los ítems del menú del issue están desactualizados.** El cuerpo de #378 todavía lista «Portafolio, Guía del inversor, Informes, Centro de ayuda» y «Guía para emprendedores»; D9 los reemplazó (comentario del owner en #378 y bitácora). El criterio 2 se mide contra D9.

## 10. Estado de entrega y próximos pasos

- Este cambio es sólo documentación: este archivo, la bitácora y las entradas de #378–#381 en `demo-tasks-list.md`. Commit en la rama de #381; la PR contra la rama de la Feature #378 es un paso posterior.
- La Feature #378 **no está en `main`** y no se cierra sola al mergear esta Task en su rama: el cierre lo decide el owner.

> [!todo] Condiciones antes del merge a `main` de #369 + #378
> 1. R1-002: resolverlo con [#398](https://github.com/reyduar/Vaqcrow/issues/398) o aceptación explícita del owner.
> 2. [#438](https://github.com/reyduar/Vaqcrow/issues/438): retirar el recorrido de seis pasos en la misma entrega.
> 3. Hacer un alta real contra el proyecto remoto: observar la entrega del email de confirmación por Resend y ejercitar ingreso y cierre de sesión, para completar los criterios 1 y 3 (y el criterio 1 de #369).
> 4. Agregar `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` a `.env.docker.example` (operador) y decidir el `WARN` de leaked password protection.

## Addendum 2026-10-03 — verificación contra el proyecto remoto

> [!info] Fuente y alcance
> Prueba del owner + logs de Supabase Auth, 2026-10-03, sobre el **preview de Vercel** `https://vaqcrow-a6dmgen8s-reyduars-projects.vercel.app` (rama de la Feature #378 en `c6be7c0`) contra el proyecto Supabase **remoto** real. No es producción ni `main`: nada de #369/#378 está en `main` todavía. Las secciones anteriores quedan como registro histórico; este addendum no las reescribe.

### Qué se verificó

| Paso | Resultado observado |
|---|---|
| Primer alta `INVERSOR` (16:03Z) | Usuario y perfil `INVERSOR` creados, `confirmation_sent_at` presente, pero **el correo no llegó**. `auth_logs`: `mail.send` con `mail_from: noreply@mail.app.supabase.io`, el mailer por defecto de Supabase: el SMTP propio (Resend) no estaba activo. El owner lo activó y borró el usuario sin confirmar. |
| Segunda alta `INVERSOR` | Correo de confirmación entregado por Resend con la plantilla «Confirm signup» (de `docs/design/template/emails/Vaqcrow Email Confirmar cuenta.html`). El logo apunta a `https://vaqcrow-web-nine.vercel.app/vaqcrow-isotipo.png`, que da 404 hasta que #378 llegue a `main`: por ahora el correo sale sin logo. |
| Confirmación | Enlace → `GET /verify` 303 (16:41:46Z) → intercambio PKCE 200 (16:41:48Z). |
| Ingreso `INVERSOR` | `POST /token` con contraseña 200 (16:42:10Z); llegó a `/portfolio` con el header de inversor de D9 y el menú del avatar (nombre y chip INVERSOR, sin email). |
| Cierre de sesión | Volvió al header público con «Ingresar» / «Crear cuenta». |
| Alta, confirmación e ingreso `PYME` | Correo → confirmación → `/company` con el menú del avatar de PyME (chip PYME; Mi campaña, Guía del emprendedor, Cerrar sesión); «Registrar mi PyME» presente (tapado por el menú abierto en la captura). |

### Criterios que cierra

- **Criterio 1** (alta respaldada por Supabase Auth real): pasa a ✅ **CUMPLIDO** — el alta con selector de rol corrió contra el remoto para los dos roles, con confirmación por correo real.
- **Criterio 3** (el cierre termina la sesión real): pasa a ✅ **CUMPLIDO** — ingreso y cierre de sesión contra el remoto; las redirecciones de páginas protegidas siguen probadas por el smoke de Playwright (no se re-probaron a mano en el preview).
- **Criterio 5** sigue ⚠️ **PARCIAL**: la accesibilidad (anillo de foco, 44 px, movimiento reducido, contraste AA) no se midió en esta prueba.

### Corrección del SMTP

Este documento, la bitácora y `environments.md` §13.2 decían que el owner había configurado el SMTP de Resend el 2026-10-02. **Era incorrecto**: los logs del primer alta real muestran el mailer por defecto de Supabase. El SMTP propio se activó el 2026-10-03 y la entrega real por Resend se observó ese mismo día.

### Defecto observado

Una cuenta `PYME` ingresó con «Soy inversor» seleccionado y llegó a `/company`. El owner lo decidió como D14 (el selector tiene que coincidir con el rol verificado; si no, el ingreso se rechaza y no queda sesión); se implementa en la rama `Vaqcrow#378_Feat_Provide_account_creation_sign_in_and_a_role_aware_shell-02-follow-ups`.

### Condiciones antes de `main` que siguen abiertas

La condición 3 de §10 queda cumplida con esta prueba. Siguen abiertas la 1 (R1-002), la 2 (#438) y la 4 (`.env.docker.example` y el `WARN` de leaked password protection).
