# Evidencia de cierre de la Feature #34 — Issue #109

> Documento de cierre de Feature. Consolida la evidencia de las Tasks [#107](https://github.com/reyduar/Vaqcrow/issues/107) (implementación), [#108](https://github.com/reyduar/Vaqcrow/issues/108) (pruebas) y [#109](https://github.com/reyduar/Vaqcrow/issues/109) (evidencia) de la Feature [#34](https://github.com/reyduar/Vaqcrow/issues/34) ("Feature: Freeze build and presentation materials", Epic [#10](https://github.com/reyduar/Vaqcrow/issues/10) "Epic: Demo delivery and presentation"). Identifica y congela el candidato demostrable, la presentación, los disclaimers exactos, el índice del paquete de evidencia y los artefactos de respaldo, y mapea cada criterio de aceptación, citado textualmente, a su resultado y a la fuente de ese resultado. La bitácora de iteración que lo alimenta es [[odd/tasks/final-build-and-presentation-freeze|Bitácora: congelamiento del build y la presentación]].

> [!warning] Alcance real: un cambio **solo de documentación**, no un test nuevo ni un build nuevo
> Esta Feature no añade código de producto, migración ni test ejecutable. Su "verificación" es la **readback** de la evidencia ya producida por el corpus (los 47 documentos `docs/planning/*-evidence.md`) más la lectura de este árbol de trabajo. No se corrió `pnpm run verify`, ni el ensayo hosteado, ni el e2e en vivo como parte de esta unidad; los resultados que aquí se citan provienen de las fuentes que cada sección nombra. Decirlo es la forma honesta de mapear los criterios de #108/#109, cuyo sujeto es el congelamiento documental, no una nueva superficie runnable.

> [!warning] Estado de entrega: el congelamiento se describe; el merge y el tag los ejecuta el owner
> El trabajo vive en la rama `Vaqcrow#34_Feat_Freeze_build_and_presentation_materials`, creada desde `main` `534f295` (merge de la PR #473) **apilada sobre la rama de #33**, cuyo contenido está presente en esta rama pero **todavía no está en `main`**. Al escribir este documento **no existe ningún tag** (`git tag -l` no devuelve nada) y **no se nombra un SHA de build** porque el commit del candidato no existe hasta que se mergeen #33 (PR #474) y esta unidad. Un tag es un **puntero**, no un artefacto construido (§3).

## 1. Contexto y objetivo

La Feature #34 es el cierre terminal del grafo canónico de la demo: congela el build demostrable y prepara los materiales de presentación que explican el **alcance validado** y las **decisiones de producción abiertas**. Depende de #33 (ensayo de la demo y empaquetado de evidencia), que aporta el ensayo hosteado y el marco de respaldo. Es la última Feature de la Epic #10.

| Task | Rama | Estado del issue (2026-10-11) |
|---|---|---|
| #107 — implementar | `Vaqcrow#34_Feat_Freeze_build_and_presentation_materials` | este documento de evidencia (no hay commit de producción propio) |
| #108 — probar | (misma rama de la Feature) | readback de la evidencia y del corpus; sin test nuevo |
| #109 — documentar | (misma rama de la Feature) | este documento |

La Feature #34 sigue abierta; su cierre lo decide el owner. La rama no tiene PR ni merge en esta unidad.

## 2. Cómo leer esta evidencia

- **Fuentes, siempre nombradas.** (a) **Corpus citado** — un `docs/planning/*-evidence.md` ya verificado; se cita, **no** se re-deriva aquí. (b) **Árbol de trabajo** — una lectura de este checkout (comandos `git`, `ls`, `grep`), sin escribir fuera de la superficie permitida.
- **Sin secretos ni PII.** Ningún email, contraseña, API key, token, seed, clave privada ni dato personal aparece aquí. Las variables se nombran, nunca sus valores. Los identificadores on-chain públicos (contratos, hashes, claves públicas Testnet) que el corpus ya publica no se reproducen salvo cuando una cita lo exige.
- **Sin claims de producción.** La entrega es de demo: Testnet sin valor económico, LLM asesor, conversión ARS↔activo simulada, KYC/KYB simulado. Nada aquí afirma disponibilidad, SLA, valor económico, auditoría del contrato ni custodia de fondos ajenos por parte de Vaqcrow.
- **Sin SHAs inventados.** El único commit que este documento podría nombrar —el del candidato congelado— no existe todavía porque el merge lo ejecuta el padre (§3).

## 3. El candidato congelado y el tag

**Decisión del owner (2026-10-11).** El build demostrable es el **`main` HEAD resultante de mergear la PR #474 (Feature #33) y esta unidad (Feature #34)**. Sobre ese `main` HEAD se coloca el **primer tag del repositorio, `v1.0.0`**.

| Aspecto | Definición |
|---|---|
| Candidato | El `main` HEAD después de mergear PR #474 (#33) y la PR de #34 |
| Tag | `v1.0.0`, el primero del repositorio |
| Quién lo coloca | El owner (acción terminal, fuera de esta superficie) |
| SHA | **No se nombra**: no existe hasta el merge. Este documento no lo inventa |
| ¿Es un artefacto? | **No.** Un tag es un **puntero** a un commit; no empaqueta, no compila y no publica nada. El "build" congelado es el commit mismo y su evidencia |

> [!info] Por qué el candidato todavía no está en `main`
> La rama de #34 está creada desde `main` `534f295` pero **apilada sobre la rama de #33** (verificado: `main` es ancestro de `HEAD`; el contenido de #33 —`scripts/demo/rehearsal/*`, la evidencia de #33— está presente en la rama de #34 y aún no en `main`). Por eso el candidato se define como el `main` HEAD *posterior* a las dos merge, y no como este `HEAD` de trabajo.
>
> La PR #474 es el identificador de la PR de #33 que aporta la unidad padre; la evidencia de #33 registra la rama (`Vaqcrow#33_Feat_Rehearse_the_demo_and_package_evidence`) con base en `main` `534f295` pero **no nombra un número de PR** (documentaba el estado "sin PR todavía"). Este documento cita #474 como el identificador provisto por la unidad padre, no como algo que su propia evidencia de #33 registre.

## 4. La presentación: narrativa por rol

El guion del demo recorre los flujos reales por rol (la demo es role-based, no un recorrido guionado único). Cada paso corresponde a una ruta o a un control real del producto, no a una pantalla inventada.

| Etapa | Ruta / control | Qué muestra |
|---|---|---|
| 1. Landing | `/` | Promesa de la demo, disclaimers visibles, CTA "Quiero financiar mi negocio" y acceso a Explorar/Ingresar |
| 2. Cuenta e ingreso | `/signup`, `/login` | Alta de PYME/inversor y login. **El toggle de rol debe coincidir con el rol de la cuenta**: una PYME que ingresa con «Soy inversor» (o al revés) es rechazada; un ADMIN no ingresa por `/login` sino por `/admin` |
| 3. Onboarding PyME (wizard) | `/company` | Wizard de un solo paso con stepper en el lugar: **KYC (simulado)** → **Registro PyME** (datos, documentos y fotos, y por qué necesita los fondos) → **Evaluación AI** (asesora) → **Revisión humana**. La conexión de **wallet Freighter es obligatoria**: sin clave pública el envío se bloquea |
| 4. Admin | `/admin` | Cola de solicitudes, contexto de revisión, **aprobación con límite** (el aporte máximo por inversor) y **deploy de la bóveda** de campaña en Testnet (firma la plataforma) |
| 5. Inversor | `/explore`, `/portfolio` | Explorar PyMEs, ver el detalle, conectar Freighter y **aportar** (firma no custodial); el aporte puede **retirarse** antes de la meta |
| 6. Distribuciones de revenue share | `/company` | La PyME declara ventas mensuales, la plataforma calcula y construye la transacción, y la PyME **firma en Freighter** |
| 7. Evidencia | `/portfolio`, `/reports`, `/company` y `/admin/pymes/[applicationId]/evidence` | Cada rol ve sus hashes y enlaces de explorador; el ADMIN ve la **cadena completa** (decisión, deploy, bóveda, aportes, distribuciones y conciliación almacenada) |

> [!note] De dónde sale esta narrativa
> La narrativa proviene de las decisiones asentadas en `AGENTS.md`/`CLAUDE.md` §"Settled decisions" (producto role-based, rutas en inglés, wizard de un solo paso, wallet obligatoria) y de las evidencias de los módulos que la implementan: [[docs/planning/public-landing-page-evidence|landing]] (#418), [[docs/planning/account-creation-sign-in-and-role-aware-shell-evidence|cuenta e ingreso por rol]] (#378), [[docs/planning/pyme-onboarding-wizard-and-document-upload-evidence|wizard de onboarding]] (#398), [[docs/planning/admin-login-shell-and-pymes-queue-evidence|admin]] (#386), [[docs/planning/application-review-and-vault-deployment-evidence|revisión y deploy]] (#410), [[docs/planning/explore-pymes-marketplace-and-listing-api-evidence|Explorar]] (#414), [[docs/planning/investor-portfolio-evidence|portafolio]] (#426), [[docs/planning/pyme-mi-campana-dashboard-evidence|Mi campaña]] (#434) y [[docs/planning/retire-scripted-journey-evidence|retiro del recorrido guionado]] (#438).

## 5. Disclaimers exactos

Estos son los **seis avisos canónicos** del corpus. Su copia canónica machine-checked vive en `apps/web/src/application/trust/disclosures.ts`, declarada **verbatim** de `docs/planning/DEMO.md` §12 ("Claims y disclaimers exactos") y `docs/design/demo-ui.md` §2 ("Reglas de confianza no negociables"). Ninguna ruta puede parafrasearlos, abreviarlos ni duplicarlos.

> **Demostración con datos simulados.** El KYC/KYB, el historial de ventas y la conversión ARS/activo Stellar son simulados. Las cuentas son reales, pero no representan una verificación de identidad ni movimientos de dinero real.

> **Stellar Testnet.** Las transacciones mostradas usan activos sin valor económico en Stellar Testnet. Un hash de Testnet demuestra ejecución técnica, no una inversión real ni disponibilidad en producción.

> **Firma no custodial.** Freighter es la wallet e interfaz de firma. La persona usuaria conserva sus claves; Vaqcrow construye y verifica la transacción y nunca recibe su seed.

> **Custodia por contrato.** Durante la campaña, los aportes los custodia el contrato, no una persona: nadie tiene una clave para moverlos. El contrato sólo puede pagar al destino fijo definido al abrir la bóveda, y ese destino es inmutable. La meta la evalúa el contrato sobre el ledger y, al alcanzarla, liquida a la PyME en la misma transacción. No hay recuperación ni clawback: no existe forma de revertir un pago ya liquidado, y los fondos que nadie reclame sólo pueden salir por el barrido; si no, pueden quedarse en el contrato. El reembolso por vencimiento no se dispara solo: exige que alguien envíe la transacción, y es permissionless porque el destino ya está fijado.

> **IA con supervisión humana.** La IA organiza evidencia, identifica anomalías y propone una evaluación explicable. No inventa datos, no toma la decisión final, no calcula obligaciones financieras y no transfiere fondos.

> **No apto para producción.** Esta demo no constituye una oferta de inversión, recomendación financiera, aprobación regulatoria ni prueba de legalidad, rentabilidad, solvencia, custodia, calidad de proveedores u operación en Argentina.

### 5.1 Cobertura de los puntos exigidos

| Punto a cubrir | Aviso que lo cubre | ¿Exacto en el corpus? |
|---|---|---|
| Demo de TFM, no producción | **No apto para producción** | Sí |
| Stellar **Testnet sin valor económico** | **Stellar Testnet** (más el rotulado persistente `TESTNET · Activos sin valor económico`) | Sí |
| **No custodial** (Vaqcrow nunca custodia claves ni mueve fondos de terceros) | **Firma no custodial** (más **Custodia por contrato** para la custodia *durante* la campaña) | Sí |
| **IA asesora** (nunca aprueba ni calcula obligaciones) | **IA con supervisión humana** | Sí |
| **Datos sintéticos/simulados** (KYC/KYB, historial de ventas, conversión ARS↔activo) | **Demostración con datos simulados** | Sí |
| Documentos y fotos **sí se suben realmente** | Complementa a **Demostración con datos simulados** ("las cuentas son reales…") | Sí — [[docs/planning/pyme-onboarding-wizard-and-document-upload-evidence|wizard]] (#398), subida real al bucket privado |

> [!warning] Corrección honesta: el "balance del wallet" no es un punto del aviso de simulación
> La unidad padre pidió cubrir el "balance del wallet" bajo "datos sintéticos/simulados". El corpus **no** lo enuncia así, y este documento no lo inventa. El aviso **Demostración con datos simulados** enumera **KYC/KYB, historial de ventas y conversión ARS↔activo** — no el balance. El saldo de la wallet de la demo es **XLM de Testnet, sin valor económico**, fondeado con **Friendbot**, y por lo tanto lo cubre el aviso **Stellar Testnet** (y el rótulo `TESTNET · Activos sin valor económico`), no el de datos simulados. Se registra la distinción en lugar de plegar el saldo a un aviso que no lo menciona.

## 6. Índice del paquete de evidencia

Un índice de todo el corpus de cierre de Feature. Hay **47 documentos pre-existentes** a este (`ls docs/planning/*-evidence.md | grep -v final-build | wc -l` → `47`; la unidad padre mencionaba 46 — la cifra verificada hoy es **47**); con este mismo documento el corpus pasa a **48**. El índice de abajo lista esos **47**, no a sí mismo. Cada línea "qué prueba" se deriva del **título** del documento (su Feature/issue), sin inventar contenido.

### Dominio y contratos

| Documento | Qué prueba |
|---|---|
| [[docs/planning/domain-states-and-shared-contracts-evidence|domain-states-and-shared-contracts]] | Máquina de estados del dominio y contratos compartidos (tipos, puertos, esquemas) |
| [[docs/planning/application-review-lifecycle-evidence|application-review-lifecycle]] | Ciclo mínimo de revisión de solicitudes y su contrato compartido |
| [[docs/planning/application-review-lifecycle-testing-evidence|application-review-lifecycle-testing]] | Pruebas exhaustivas de ese ciclo y su contrato |

### Persistencia / Supabase

| Documento | Qué prueba |
|---|---|
| [[docs/planning/supabase-schema-and-persistence-evidence|supabase-schema-and-persistence]] | Esquema Supabase y capa de persistencia (RLS, grants explícitos, updates condicionales idempotentes) |
| [[docs/planning/typed-configuration-and-secret-boundaries-evidence|typed-configuration-and-secret-boundaries]] | Configuración tipada y límites de secretos |
| [[docs/planning/campaign-persistence-and-reconciliation-evidence|campaign-persistence-and-reconciliation]] | Persistencia de campaña y conciliación (renombró `funding_intent` → `funding_intent_legacy`) |

### Identidad / RLS

| Documento | Qué prueba |
|---|---|
| [[docs/planning/supabase-auth-roles-and-authorization-evidence|supabase-auth-roles-and-authorization]] | Supabase Auth, roles PYME/INVERSOR/ADMIN y autorización con RLS |
| [[docs/planning/account-creation-sign-in-and-role-aware-shell-evidence|account-creation-sign-in-and-role-aware-shell]] | Creación de cuenta, ingreso y shell consciente del rol |
| [[docs/planning/admin-login-shell-and-pymes-queue-evidence|admin-login-shell-and-pymes-queue]] | Ingreso del admin, shell `/admin` y cola de PyMEs |

### Stellar / bóveda / contratos

| Documento | Qué prueba |
|---|---|
| [[docs/planning/campaign-vault-contract-evidence|campaign-vault-contract]] | Contrato de bóveda de campaña (Soroban): custodia, destino fijo, meta on-chain, reembolso permissionless |
| [[docs/planning/soroban-toolchain-and-reproducible-deployment-evidence|soroban-toolchain-and-reproducible-deployment]] | Toolchain Soroban y despliegue reproducible |
| [[docs/planning/stellar-and-freighter-integration-evidence|stellar-and-freighter-integration]] | Integración con Stellar y Freighter (firma no custodial) |
| [[docs/planning/asynchronous-stellar-confirmation-evidence|asynchronous-stellar-confirmation]] | Confirmación asíncrona de transacciones ("enviado" ≠ "confirmado") |
| [[docs/planning/funding-intent-submission-and-xdr-verification-evidence|funding-intent-submission-and-xdr-verification]] | Envío de intención de fondeo y verificación de XDR (camino **retirado** por #239/#438; histórico) |
| [[docs/planning/campaign-vault-web-journey-evidence|campaign-vault-web-journey]] | Recorrido web de la bóveda de campaña |
| [[docs/planning/testnet-revenue-share-distribution-evidence|testnet-revenue-share-distribution]] | Distribución de revenue share en Testnet |
| [[docs/planning/application-review-and-vault-deployment-evidence|application-review-and-vault-deployment]] | Revisión de solicitud y despliegue de la bóveda (#410) |
| [[docs/planning/revenue-share-calculation-evidence|revenue-share-calculation]] | Cálculo determinístico del revenue share (la IA no calcula la obligación) |

### IA

| Documento | Qué prueba |
|---|---|
| [[docs/planning/replaceable-llm-adapter-evidence|replaceable-llm-adapter]] | Adaptador de LLM reemplazable y aislado del dominio |
| [[docs/planning/ai-assessment-schema-and-guardrails-evidence|ai-assessment-schema-and-guardrails]] | Esquema de evaluación de IA y guardarraíles |
| [[docs/planning/ai-failure-routing-evidence|ai-failure-routing]] | Ruteo de fallos de IA y respaldo veraz |
| [[docs/planning/ai-completeness-check-and-submission-evidence|ai-completeness-check-and-submission]] | Chequeo de completitud (reglas declaradas) y envío (#402) |
| [[docs/planning/content-relevance-vision-evidence|content-relevance-vision]] | Relevancia por contenido (visión) del chequeo de completitud |
| [[docs/planning/human-assessment-and-approval-evidence|human-assessment-and-approval]] | Evaluación humana y aprobación con límite (#19) |

### Wizard / onboarding

| Documento | Qué prueba |
|---|---|
| [[docs/planning/pyme-onboarding-wizard-and-document-upload-evidence|pyme-onboarding-wizard-and-document-upload]] | Wizard de onboarding PyME y **subida real** de documentos/fotos (#398) |
| [[docs/planning/pyme-wallet-connection-evidence|pyme-wallet-connection]] | Conexión de wallet Freighter de la PyME (#406) |
| [[docs/planning/document-workspace-evidence|document-workspace]] | Workspace de documentos |
| [[docs/planning/sme-request-and-evidence-review-evidence|sme-request-and-evidence-review]] | Solicitud de PyME y revisión de evidencia (#18) |
| [[docs/planning/monthly-sales-feed-evidence|monthly-sales-feed]] | Feed de ventas mensuales (#26) |

### Marketplace / inversor

| Documento | Qué prueba |
|---|---|
| [[docs/planning/explore-pymes-marketplace-and-listing-api-evidence|explore-pymes-marketplace-and-listing-api]] | Explorar PyMEs (marketplace) y API de listado (#414) |
| [[docs/planning/campaign-detail-and-contributions-evidence|campaign-detail-and-contributions]] | Detalle de campaña y aportes (#422) |
| [[docs/planning/investor-portfolio-evidence|investor-portfolio]] | Portafolio del inversor (`/portfolio`) (#426) |
| [[docs/planning/investor-reports-evidence|investor-reports]] | Informes del inversor (`/reports`) (#430) |
| [[docs/planning/pyme-mi-campana-dashboard-evidence|pyme-mi-campana-dashboard]] | Panel "Mi campaña" de la PyME y declaración de ventas (#434) |
| [[docs/planning/public-landing-page-evidence|public-landing-page]] | Landing pública (#418) |
| [[docs/planning/about-guides-and-help-center-evidence|about-guides-and-help-center]] | Acerca de, guías y centro de ayuda (#394) |

### Notificaciones

| Documento | Qué prueba |
|---|---|
| [[docs/planning/in-app-notifications-and-resend-email-evidence|in-app-notifications-and-resend-email]] | Notificaciones in-app (campana) y email por Resend detrás de un port (#382) |

### Despliegue / entornos

| Documento | Qué prueba |
|---|---|
| [[docs/planning/cloud-environment-configuration-evidence|cloud-environment-configuration]] | Configuración del entorno en la nube y split de perfiles (#286/#287) |

### Testing

| Documento | Qué prueba |
|---|---|
| [[docs/planning/deterministic-testing-and-ci-gates-evidence|deterministic-testing-and-ci-gates]] | Testing determinístico y gates de CI (#15) |

### Retiro del recorrido

| Documento | Qué prueba |
|---|---|
| [[docs/planning/retire-scripted-journey-evidence|retire-scripted-journey]] | Retiro del recorrido guionado de seis pasos y redistribución de su evidencia por rol (#438) |

### Ensayo / cierre / confianza

| Documento | Qué prueba |
|---|---|
| [[docs/planning/demo-rehearsal-and-evidence-packaging-evidence|demo-rehearsal-and-evidence-packaging]] | Ensayo de la demo y empaquetado de evidencia (#33) — habilita a #34 |
| [[docs/planning/resilience-telemetry-and-fallbacks-evidence|resilience-telemetry-and-fallbacks]] | Telemetría de resiliencia y fallbacks veraces (#31) |
| [[docs/planning/complete-vertical-demo-journey-evidence|complete-vertical-demo-journey]] | Recorrido vertical completo de la demo (#30) |
| [[docs/planning/evidence-dashboard-evidence|evidence-dashboard]] | Dashboard de evidencia (#29) |
| [[docs/planning/guided-demo-shell-and-navigation-evidence|guided-demo-shell-and-navigation]] | Shell guiado de la demo y navegación (#16) |
| [[docs/planning/trust-disclosures-and-synthetic-fixtures-evidence|trust-disclosures-and-synthetic-fixtures]] | Avisos de confianza y fixtures sintéticos (#17) |
| [[docs/planning/trust-disclosures-and-contract-custody-evidence|trust-disclosures-and-contract-custody]] | Reconciliación de los avisos con la custodia por contrato (#240) |

## 7. Artefactos de respaldo

Los artefactos que respaldan la demo, y lo que cubre cada uno. Los dos verificadores vivos son **opt-in**: nunca corren en `pnpm run verify`, en `turbo test` ni en CI (`docs/architecture/environments.md`).

| Artefacto | Ruta / comando | Qué cubre | Opt-in |
|---|---|---|---|
| Ensayo hosteado | `scripts/demo/rehearsal/hosted-rehearsal.mjs` (desde `apps/api`: `node --env-file=../../.env.cloud ../../scripts/demo/rehearsal/hosted-rehearsal.mjs`) | Recorrido completo del flujo por roles **a nivel API, sin navegador**, contra el stack desplegado (Railway API + Supabase remoto + Testnet); produce hashes/contratos/claves públicas, nunca secretos ([[docs/planning/demo-rehearsal-and-evidence-packaging-evidence|#33]]) | Sí |
| e2e en vivo local | `apps/web/e2e-live/admin-review.live.spec.ts`, `pnpm --filter @vaqcrow/web run test:e2e:live` | Recorrido **de pantallas** de los tres roles contra el perfil docker (`STELLAR_NETWORK=local`), Freighter emulado; desde #472 el primer aporte corre por la UI (`6ea5549`) | Sí |
| Preflight cloud | `pnpm demo:preflight --env-file .env.cloud` | Estado del entorno: variables de API/web, email, `/health`, Horizon/RPC Testnet, fábrica de campaña, cuentas de plataforma, esquema remoto y ADMIN activo | Sí (perfil cloud) |
| Suite determinística | `pnpm run verify` (lint + typecheck + test + build + boundaries + test:boundaries) | Gate de PR con dobles locales; nunca toca Testnet, Horizon ni el LLM vivo | No — es el gate |

> [!info] Los dos verificadores vivos son opt-in y se declaran como tales
> El ensayo hosteado y el e2e en vivo **no forman parte de `pnpm run verify`** ni de CI. Sus resultados, cuando se citan, provienen de corridas manuales fechadas; este documento no los re-ejecutó (§9).

## 8. Decisiones de producción abiertas

Resumen de lo que el corpus ya registra como abierto. Ninguna es una decisión nueva de este documento.

| Decisión abierta | Estado registrado | Fuente |
|---|---|---|
| Clasificación jurídica del instrumento (¿valores, crowdfunding, crédito, pagos o intermediación?) | Abierta; requiere asesoría argentina por escrito | `product.md` §1 |
| Cumplimiento regulatorio / AML / KYC real | Abierta; el KYC/KYB de la demo es simulado | `product.md` §1, §4 |
| Corredor ARS↔activo Stellar (partner y activo) | **No validado**; P0 abierto | `product.md` §7.3 |
| Privacidad y tratamiento de datos personales | Abierta | `product.md` §4, §10 |
| Verificación de ventas y cobranza reales | Abierta; la demo no prueba ventas fuera de cadena | `product.md` §2 |
| Auditoría y controles de emergencia del contrato | La bóveda de la demo **no está auditada, no es actualizable y no tiene pausa** | [[docs/planning/trust-disclosures-and-contract-custody-evidence|trust-disclosures-and-contract-custody]] §7 |
| Actualizabilidad/pausa del contrato | Decisión abierta registrada en `DEMO.md` | [[docs/planning/soroban-toolchain-and-reproducible-deployment-evidence|soroban-toolchain…]] §5 |
| Token propio | **No emitir en el MVP** | `product.md` §1 |
| Dominio propio para la web | **Diferido** para la demo; el `*.vercel.app` alcanza para presentar | [[docs/planning/cloud-environment-configuration-evidence|cloud-environment…]] §"Dominio propio" |

## 9. Límites honestos

1. **Brechas del paquete de #33.** Faltan **video de respaldo, set de capturas de pantalla, XDR decodificado y el JSON de evaluación de IA** como artefactos; son pasos del operador. El ensayo hosteado conserva hashes y contratos, pero **no** produce esos cuatro. ([[docs/planning/demo-rehearsal-and-evidence-packaging-evidence|#33]] §8)
2. **Stack local degradado al momento del congelamiento.** El e2e en vivo **no se observó en verde** en la sesión de #33: la API del perfil docker acumulaba timeouts de verificación de Supabase Auth y una lectura devolvía `503 unavailable`; `supabase_pg_meta_vaqcrow` estaba `unhealthy`. Es un defecto de **entorno**, no del spec ni del producto; su historial verde (corridas E–K) se cita. ([[docs/planning/demo-rehearsal-and-evidence-packaging-evidence|#33]] §6)
3. **Sensibilidad a la carga del suite `@vaqcrow/web`.** Bajo carga, tests que agotan el timeout de 5 s fallan por contención de CPU, no por código; los archivos afectados pasan en aislamiento. ([[docs/planning/resilience-telemetry-and-fallbacks-evidence|#31]] §5.1)
4. **Reset de Testnet del 2026-12-16.** Después de esa fecha, las direcciones de contrato de Testnet quedan invalidadas: la fábrica debe redesplegarse y `STELLAR_CAMPAIGN_FACTORY_ID` re-apuntarse. Es un límite de tiempo del entorno, no del código.
5. **El candidato todavía no está en `main` y no hay tag.** Este documento describe el congelamiento; el merge (PR #474 y la PR de #34) y el tag `v1.0.0` los ejecuta el owner. No se reporta un estado mergeado ni un tag existente.

## 10. Mapeo de criterios de aceptación

Los criterios se citan **textualmente** desde cada issue.

### Feature #34

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Tag the demonstrable build and prepare final presentation materials explaining validated scope and open production decisions." | ✅ **CUMPLIDO** (a nivel de materiales). El candidato y el tag `v1.0.0` quedan definidos (§3), la presentación por rol escrita (§4), los disclaimers exactos citados (§5), el índice del paquete de evidencia construido (§6) y las decisiones de producción abiertas resumidas (§8). El **acto** de colocar el tag lo ejecuta el owner; su definición queda congelada aquí. | §3–§8 |
| 2 | "Required evidence and failure behavior are covered." | ✅ **CUMPLIDO.** La evidencia es este documento más el corpus (47 documentos, §6). El **comportamiento de fallo** del congelamiento es "no inventar": no se nombra un SHA inexistente (§3), no se declara un tag que no existe (§9.5), y los límites honestos (§9) se declaran en lugar de ocultarse. | §3, §6, §9 |
| 3 | "No unsupported production claims or secrets are introduced." | ✅ **CUMPLIDO.** Sin secretos, PII, seeds ni claves; sin XDR. Los disclaimers (§5) preservan el encuadre Testnet/simulado/no-custodial/IA-asesora; ninguna afirmación de producción se introduce (§2, §8). | §2, §5, §8 |

### Task #107 — implementación

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Feature #34 behavior is implemented within its documented boundary." | ✅ **CUMPLIDO.** Es un cambio solo de documentación dentro de la superficie permitida: `docs/planning/final-build-and-presentation-freeze-evidence.md` y `odd/tasks/final-build-and-presentation-freeze.md`. Ningún archivo de producto, test o configuración. | Este documento; verificación de la superficie |
| 2 | "Freeze and identify the final demo candidate, presentation, exact disclaimers, evidence package, and backup artifacts after required checks pass, with no unreviewed late scope expansion." | ✅ **CUMPLIDO.** Candidato + tag (§3), presentación (§4), disclaimers exactos (§5), índice del paquete (§6) y artefactos de respaldo (§7) congelados. Sin expansión de alcance: no se agrega scope nuevo al build; el tag queda como definición del owner. | §3–§7 |
| 3 | "Failure paths remain truthful and do not weaken security, simulation, or human-control boundaries." | ✅ **CUMPLIDO.** El "camino de fallo" documental es de honestidad: se corrigen afirmaciones y se declaran límites (§5.1 nota, §9), sin fabricar un artefacto ni un tag inexistente. Los límites humano (decisión del admin), simulación (Testnet/ARS/saldo) y seguridad (sin custodiar claves) quedan intactos. | §5.1, §9 |

### Task #108 — pruebas

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Deterministic tests or bounded rehearsal checks demonstrate the core behavior of Feature #34." | ⚠️ **PARCIAL, con justificación.** Esta Feature es **documental**: no agrega comportamiento runnable propio, así que su verificación no es un test nuevo (§"Alcance real"). Los **bounded rehearsal checks** que respaldan el congelamiento son los de #33 —el ensayo hosteado (3 runs verdes a nivel API) y el preflight cloud—, **citados, no re-ejecutados** aquí ([[docs/planning/demo-rehearsal-and-evidence-packaging-evidence|#33]] §4–§5). | §7; #33 §4–§5 |
| 2 | "Validation, rejection, and fallback behavior is covered where applicable." | ⚠️ **PARCIAL, con justificación.** No aplica un rechazo nuevo: el congelamiento no tiene validación de entrada propia. El comportamiento de fallo que sí se cubre es el documental (§9, y #34/#107 criterio 2/3): declarar límites y no inventar. Se declara (no se finge) que no hay una superficie de validación/rechazo nueva. | §9; §10 |
| 3 | "The focused verification passes without exposing sensitive data." | ✅ **CUMPLIDO** en lo que aplica. La verificación focal de esta unidad es la readback (lectura de este árbol y del corpus); no expone secretos ni PII (§2, §10.3). No se reporta como "corrida verde" algo que no se corrió. | §2, §10 |

### Task #109 — evidencia

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Evidence identifies Feature #34, verification commands or rehearsal steps, and observed results." | ✅ **CUMPLIDO.** Este documento identifica la Feature #34 y sus Tasks (§1), nombra el ensayo, el e2e, el preflight y la suite determinística (§7), y registra resultados citados de sus fuentes. | §1, §7 |
| 2 | "Evidence is traceable to implementation and focused verification." | ✅ **CUMPLIDO.** Cada afirmación nombra su fuente (corpus citado o árbol de trabajo); los defectos y límites (§9) apuntan a la sección de su documento de origen. | §3–§9 |
| 3 | "Sensitive data and unsupported production claims are excluded." | ✅ **CUMPLIDO.** Sin secretos, PII, seeds, XDR ni SHAs inventados; sin claims de producción (§2). | §2, §9 |

## 11. Estado de entrega y próximos pasos

- Este cambio es: `docs/planning/final-build-and-presentation-freeze-evidence.md` (nuevo) y `odd/tasks/final-build-and-presentation-freeze.md` (nuevo). No hay PR ni merge en esta unidad (los ejecuta el padre).
- La Feature #34 queda **abierta**; su cierre y el de #107/#108/#109 lo decide el owner.

> [!todo] Condiciones antes de considerar cerrada la Feature #34
> 1. Mergear PR #474 (Feature #33) y la PR de esta unidad a `main`; recién entonces colocar el tag `v1.0.0` sobre ese `main` HEAD (acción del owner) y nombrar el commit resultante.
> 2. Producir los artefactos de respaldo que #33 dejó pendientes (video, capturas, JSON de IA y, si el owner lo decide, XDR decodificado) — §9.1.
> 3. Decidir si el "across the template screens" se satisface con el e2e U9 o se agrega un recorrido de pantallas dedicado — heredado de #33 §11.
> 4. Re-ejecutar el e2e U9 en un stack local sano y adjuntar su salida — heredado de #33 §11.
