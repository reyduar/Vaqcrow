---
title: Límites de identidad y RLS
tags:
  - architecture
  - security
  - supabase
  - rls
date: 2026-09-28
updated: 2026-10-01
status: accepted
---

# Vaqcrow — Límites de identidad y RLS

> [!important] Actualización 2026-10-01: el modelo de identidad ya existe, en la rama de la Feature
> La Task [#370](https://github.com/reyduar/Vaqcrow/issues/370) de la Feature [#369](https://github.com/reyduar/Vaqcrow/issues/369) implementa Supabase Auth, roles, RLS y autorización de la API (§9). **Esa implementación vive en la rama de la Feature `Vaqcrow#369_Feat_Establish_Supabase_Auth_roles_RLS_and_API_authorization` y todavía no está en `main`**: llega junto con [#378](https://github.com/reyduar/Vaqcrow/issues/378) (login y shell por rol) en una entrega apilada. Las secciones §1–§8 conservan la decisión original de #196 y su razonamiento; donde describen «no hay autenticación», describen `main` y el estado previo a #370. La decisión de que `application_review` y `human_decision` siguen siendo **sólo `service_role`** se mantiene vigente (§9.6).

> [!info] Objetivo
> Registrar la decisión que resuelve el issue [#196](https://github.com/reyduar/Vaqcrow/issues/196): qué se hace con las dos tablas que hoy tienen RLS habilitada y cero políticas —`public.application_review` y `public.human_decision`—, por qué **todavía no** se escriben políticas de fila, y qué las desbloquea. Complementa [[docs/planning/supabase-schema-and-persistence-evidence|la evidencia del esquema y la persistencia]] (#13) y [[docs/planning/human-assessment-and-approval-evidence|la evidencia de la evaluación y aprobación humana]] (#19), que difieren este trabajo acá.

## 1. La decisión

**Fecha:** 2026-09-28. **Decidido por:** la persona dueña del repositorio.

El modelo de identidad **sí va a existir**, así que el issue se resuelve por su **opción 2**, no por la 1: las políticas RLS que expresan la relación identidad→fila van a existir, pero quedan **diferidas** hasta que exista un modelo de identidad. No se escribe ninguna política en este cambio.

La persona dueña declaró tres niveles de acceso:

| Nivel | Descripción declarada | Corresponde a |
|---|---|---|
| **Admin** | Accede al módulo de administración; no es PyME ni inversor. | `Operador/admin` del mapa de pantallas (secciones 16 y 18 de [[docs/design/demo-ui|Diseño de experiencia]]) |
| **Inversor** | La persona usuaria común que visita el marketplace para invertir. | `Inversor` de la sección 3 de [[docs/design/demo-ui|Diseño de experiencia]] |
| **PyME** | La persona usuaria que quiere recibir inversión. | `PyME` de la sección 3 de [[docs/design/demo-ui|Diseño de experiencia]] |

> [!question] Lectura aplicada, corregible por una persona
> El mapeo anterior es la lectura que este documento aplica para aterrizar los tres niveles declarados sobre lo que el repositorio ya documenta. Se deja explícito para que una persona pueda corregirlo sin tener que reconstruirlo:
>
> - El nivel **Admin** corresponde a **`Operador/admin`** del mapa de pantallas, no a `Operador` a secas: la sección 4 de [[docs/design/demo-ui|Diseño de experiencia]] usa `Operador/admin` como actor de las pantallas de administración (secciones 16 y 18 del mapa).
> - **`Visitante`** es el actor **no autenticado** (landing, página Acerca de): no es un nivel de acceso, es la ausencia de identidad.
> - **`Evaluador/observador`** es la persona del tribunal que recorre la demo para verificar evidencia; **no es un nivel autenticado** ni un sujeto contra el cual escribir una política.
>
> Si esa lectura no coincide con la intención de la persona dueña, este es el lugar donde corregirla antes de que las políticas se escriban.

## 2. Estado actual, con precisión

Verificado contra el proyecto Supabase en vivo el 2026-09-20 al auditar la Feature [#13](https://github.com/reyduar/Vaqcrow/issues/13) (`pg_class`, `pg_policies` y el advisor de seguridad), y consistente con las migraciones del repositorio:

| Tabla | RLS habilitada | Políticas | ACL de tabla |
|---|---|---|---|
| `public.application_review` | sí | **0** | sólo `postgres` y `service_role` |
| `public.human_decision` | sí | **0** | sólo `postgres` y `service_role` |

**Las dos tablas son un par, no una sola.** La evidencia original de #13 nombraba únicamente `application_review`; `human_decision` llegó después, desde una Feature distinta ([#19](https://github.com/reyduar/Vaqcrow/issues/19)), y repitió el mismo patrón. El alcance de esta decisión son las dos.

**Qué deniega el acceso hoy, exactamente.** No es RLS: es la capa de GRANT. Cada migración que crea la tabla ejecuta `revoke all on public.<tabla> from anon, authenticated` en la misma migración que el `create table`, de modo que ningún grant CRUD por defecto sobrevive —ni transitoriamente—, y luego otorga sólo a `service_role` (`revoke`/`grant` en `supabase/migrations/20260918114635_create_application_review.sql` línea 43, `20260919181453_create_human_decision_audit.sql` línea 33, y la corrección de inmutabilidad de `20260919203900_enforce_human_decision_grant_immutability.sql`). `anon` y `authenticated` no tienen **ningún** permiso a nivel de tabla, así que Postgres responde `42501` (`permission denied`) **antes de llegar a evaluar RLS**. La evaluación de políticas ni siquiera se ejecuta: el GRANT ya negó la operación. La API es el único escritor y se conecta como `service_role`, que además hace bypass de RLS.

En síntesis: **RLS habilitada, cero políticas, `service_role` como único rol de aplicación.** El mecanismo está implementado por tabla y es deliberado.

## 3. Por qué las políticas no se pueden escribir todavía

Una política RLS necesita un **sujeto**: `auth.uid()`, un claim de un JWT, un rol — algo contra lo cual escribir `using (...)`. En `main` **no hay ninguna capa de autenticación** (estado al decidir #196): no hay Auth.js, no hay sesión, no hay `auth.uid()`. El único llamador es la API como `service_role`, que hace bypass de RLS por completo.

> [!warning] La tensión de [#134](https://github.com/reyduar/Vaqcrow/issues/134)
> [#134](https://github.com/reyduar/Vaqcrow/issues/134) ("Establish Auth.js authentication and session boundaries") es la Feature donde nacería una identidad de persona usuaria. Está **cerrado como completed**, pero **todos sus criterios de aceptación siguen sin marcar y no hay ninguna implementación versionada en `main`**. Este documento nombra esa contradicción en lugar de taparla: el estado del issue no es evidencia de que la capa de autenticación exista. En `main`, hoy, no existe; la Feature [#369](https://github.com/reyduar/Vaqcrow/issues/369) lo reemplaza con Supabase Auth (§9) y supersede el límite de Auth.js (decisión del owner, 2026-10-01).

Escribir una política ahora sería inventar un modelo de seguridad sin ninguna identidad contra la cual fijarlo —y una política que devolviera `true` para todos convertiría un aviso INFO en un agujero real, con la apariencia de estar resuelto. Ése es el único movimiento que empeoraría la situación. Por eso la política se **posterga**, no se improvisa.

## 4. El riesgo condicional

**Hoy no hay nada expuesto**, y eso es cierto sólo porque faltan los grants. El riesgo es condicional y conviene enunciarlo con precisión:

> El día en que cualquier rol además de `service_role` o `postgres` reciba un `GRANT` sobre cualquiera de las dos tablas, obtiene **acceso irrestricto a nivel de fila a todas las filas**, porque no hay ninguna política que filtre nada. La ausencia de políticas es segura hoy únicamente porque la ausencia de grants la acompaña. Es un equilibrio frágil: está a un `grant` de ser una lectura completa de la tabla.

Ése es el motivo por el que este cambio agrega una guarda determinística (ver §6) en lugar de confiar en la memoria: la contención no debe poder romperse en silencio.

## 5. El hallazgo del advisor: aceptado

El advisor de seguridad de Supabase reporta `rls_enabled_no_policy`, nivel **INFO**. Para las dos tablas de este documento —`public.application_review` y `public.human_decision`— el hallazgo corresponde al diseño deliberado descripto en §2 y se **acepta explícitamente**. Su nivel es INFO: no es un aviso de exposición, es la constatación de que RLS está habilitada sin políticas. La contención equivalente para esas dos tablas está en la guarda `tests/rls-grants-containment.test.ts` (§6).

> [!warning] El conteo del advisor es 6, no 2
> Releído contra el proyecto en vivo el 2026-09-28, el advisor devuelve **count 6** para `rls_enabled_no_policy`, no el count 2 que registraba el issue [#196](https://github.com/reyduar/Vaqcrow/issues/196) el 2026-09-20. Las dos tablas de este documento siguen presentes, pero **cuatro tablas más** llegaron después desde otras Features y hoy tienen la misma forma: `public.campaign`, `public.campaign_contribution`, `public.campaign_refund_contact` y `public.funding_intent_legacy`.
>
> Sus migraciones también revocan de `anon, authenticated` antes de otorgar sólo a `service_role`, así que el mismo mecanismo de contención por GRANT las cubre hoy. Pero sus políticas quedan **fuera del alcance de #196**, que nombra exactamente las dos tablas de §2, y **no están cubiertas por la guarda de §6**. Se dejan registradas acá, con su conteo real, para que el número no vuelva a quedar desactualizado en silencio y para que quien retome el trabajo vea que el patrón se repitió cuatro veces más.

## 6. Qué desbloquea las políticas y dónde vivirán

Las políticas se desbloquean cuando exista un **modelo de identidad**: el día en que haya un sujeto (una sesión, un `auth.uid()`, un claim o un rol de persona usuaria) contra el cual expresar la relación identidad→fila —por ejemplo, que una PyME lea sólo su propio `application_review`, o que un rol admin lea lo que su módulo necesita.

Cuando eso ocurra, las políticas se escriben como una **Task bajo la Feature que introduzca esa identidad**, y este documento (§1–§5) es su prerrequisito: fija el alcance (las dos tablas), el mecanismo vigente y la razón por la que no se escribieron antes. Hasta entonces, la contención se sostiene con dos piezas que sí existen hoy:

1. El `revoke all ... from anon, authenticated` en la migración de cada tabla, y
2. la guarda determinística `tests/rls-grants-containment.test.ts`, que recorre `supabase/migrations/*.sql` en orden de nombre y falla si algún `grant` alcanza `application_review` o `human_decision` con `anon` o `authenticated`. La guarda afirma además que **encuentra** las revocaciones, para que no pueda pasar de forma vacua.

## 7. Lo que este documento no afirma

- **No afirma que exista autenticación en `main`.** La implementación (§9) está en la rama de la Feature #369, apilada con #378, y no se fusionó a `main`.
- **No afirma que existan políticas sobre `application_review` ni `human_decision`.** No existen y se mantienen así por decisión (§9.6); las únicas políticas implementadas son las de `profile` (§9.3).
- **No afirma que la demo exponga estas tablas.** No hay hoy ninguna ruta, pantalla ni endpoint que las lea o escriba para un rol distinto de `service_role`.
- **No afirma que el estado actual sea producto de una política.** Lo que deniega es el GRANT (§2).

## 8. Reversión / cuándo revisar

Esta decisión se revisa cuando el modelo de identidad de §9 llegue a `main` (el reemplazo de [#134](https://github.com/reyduar/Vaqcrow/issues/134) es la Feature #369). En esa revisión hay que: (a) decidir el mapeo definitivo de los niveles de §1 contra las filas de cada tabla, (b) escribir las políticas como una Task de esa Feature, y (c) reemplazar la guarda por las pruebas de acceso no privilegiado que correspondan.

Si en cambio se decide que la demo acotada **nunca** expondrá estas tablas a un rol distinto de `service_role`, la resolución correcta es la **opción 1** del issue: dejar registrada esa decisión y conservar la guarda como contención permanente. Ambas salidas son legítimas; lo que no lo es es escribir una política sin identidad.

## 9. El modelo de identidad implementado (Task #370, rama de la Feature #369)

> [!warning] Alcance de entrega
> Todo lo de esta sección está en la rama de la Feature #369 y **no en `main`**. Se entrega apilado con #378: hasta entonces la demo desplegada conserva el comportamiento anterior. No hay un interruptor `API_AUTH_MODE`: la autorización por defecto rompería la web desplegada antes del login, y un interruptor de seguridad mal configurado dejaría la API abierta (decisión del owner, 2026-10-01). La web todavía **no envía tokens**; eso es una ruptura conocida hasta #378.

### 9.1 Roles y perfil

La migración `supabase/migrations/20260930180000_create_identity_and_audit.sql` crea `public.profile` (una fila por usuario de `auth.users`): rol `PYME` / `INVERSOR` / `ADMIN`, nombre visible, usuario único y estado `active` / `inactive`. Aplicada y verificada en el proyecto remoto. Un usuario `inactive` recibe `401` aunque su token sea válido. Se desactiva, no se borra: la FK `audit_log.actor_user_id → profile` impide borrar a quien tiene auditoría.

### 9.2 Trigger de alta

`on_auth_user_created` ejecuta `handle_new_user()` (`security definer`, `search_path=''`, sin `execute` para `anon`/`authenticated`) y crea el perfil. El rol `ADMIN` **sólo entra por `app_metadata`**, que escribe únicamente `service_role`; el `user_metadata` —editable por la propia persona— sólo puede pedir `PYME` o `INVERSOR`. Así nadie se autoasigna `ADMIN`. El superadmin («Admin Vaqcrow», `vaqcrow.admin`) se siembra con `pnpm --filter @vaqcrow/api seed:superadmin:docker|cloud` (script manual por perfil; email y contraseña desde `VAQCROW_SUPERADMIN_EMAIL` / `VAQCROW_SUPERADMIN_PASSWORD`; nunca al arrancar la API). El preflight comprueba que exista un `ADMIN` activo.

### 9.3 RLS

`profile` tiene RLS y la política `profile_select_own` (cada persona autenticada lee sólo su fila). Los grants son explícitos: `authenticated` sólo `SELECT`; `service_role` escribe. Esta es la primera política real del repositorio y reemplaza el «cero políticas» **para `profile`**; no cambia el patrón de las demás tablas.

### 9.4 Autorización en la API

`apps/api` valida el token en el servidor (`AuthPort` + adaptador `SupabaseAuth`: `auth.getUser(token)` y rol leído de `profile`, con timeout de 5 s) y aplica un hook `onRequest` con **denegación por defecto**: la tabla de políticas vive en `apps/api/src/application/authorization/route-policy.ts` y toda ruta no listada se deniega. Respuestas: `401 unauthenticated` (sin token, token inválido o perfil inactivo), `403 forbidden` (rol sin permiso) y `503 unavailable` (el proveedor de identidad no responde, o el adaptador lanza una excepción en lugar de devolver el error). Todo cuerpo de denegación es exactamente `{ code }`, sin `message`, `details` ni traza. El rol sale de `profile`, nunca del cliente. El `actor` de la decisión humana es el `displayName` del admin autenticado y ya no viaja en el body (el `displayName` no es único: el `userId` quedará en `audit_log` cuando se cablee la auditoría).

### 9.5 Registro de auditoría

`public.audit_log` es append-only (`service_role` sólo `INSERT`/`SELECT`). El puerto `AuditLogPort` y su adaptador están cableados en `index.ts` pero **todavía no se invocan**; se usan cuando una Task posterior los llame (#410).

### 9.6 Lo que no cambia

`application_review` y `human_decision` siguen siendo **sólo `service_role`** (la API es la única escritora) y `tests/rls-grants-containment.test.ts` sigue vigente. No se escriben políticas sobre ellas.

### 9.7 Brecha conocida: R1-002 (propiedad por fila)

> [!warning] Las rutas `PYME` verifican el rol, no la propiedad de la fila
> Una PyME registrada podría leer la solicitud de otra por id, leer o escribir las ventas de cualquier negocio y leer cualquier distribución. Reduce la exposición respecto de `main` (rutas sin autenticación) y la propiedad por fila llega con [#398](https://github.com/reyduar/Vaqcrow/issues/398). Como #369 y #378 llegan juntas a `main`, **R1-002 se resuelve o el owner lo acepta explícitamente antes de ese merge**.

### 9.8 Email

Confirmación de email activada: en local Mailpit captura los correos (`:54324`); en el remoto el SMTP es Resend (`no-reply@vaqcrow.com`), configurado por el owner según [[docs/architecture/environments|environments.md]] §13 — **pendiente** al 2026-10-01. La recuperación de contraseña se difiere a un issue posterior (decisión del owner).
