# Bitácora — Feature #410: revisión, aprobación y despliegue de la bóveda

Rama de integración: `Vaqcrow#410_Feat_Review_applications_and_approve_to_deploy_and_publish_the_vault`.
Base: rama de integración de #406, ya reconciliada y cerrada en GitHub.

## Objetivo

Entregar la revisión admin de una solicitud real —evidencia KYC/KYB, recomendación consultiva de IA y decisión humana— y hacer que «Aprobar con límite» dispare exactamente un despliegue de bóveda firmado por la plataforma, con la clave pública de la PyME como destino inmutable, seguido de la publicación de la campaña cuando Testnet confirme.

## Problema y por qué

La pila anterior ya permite que la PyME complete la solicitud, conecte Freighter y llegue a revisión. Falta cerrar el lado humano: el admin debe inspeccionar la evidencia, registrar una decisión atribuida y convertir una aprobación en un despliegue/p publicación idempotente, sin que la IA apruebe ni Vaqcrow custodie claves.

## Alcance autorizado

- Reutilizar las rutas y puertos existentes de solicitud, assessment, decisión humana, notificaciones y campañas/vault.
- Agregar acceso admin seguro para visualizar o descargar PDFs, imágenes y fotos privadas.
- Implementar la revisión, validaciones, auditoría, despliegue idempotente, estados pendientes/fallidos y notificaciones que el owner decida.
- Mantener la firma de `factory.deploy` exclusivamente en la plataforma y el destino de la PyME inmutable.
- Actualizar tests, evidencia y bitácora en el mismo work unit.

## Restricciones

- La IA es consultiva: nunca aprueba, calcula obligaciones ni transfiere fondos.
- No se solicitan, almacenan ni transportan seeds o claves privadas de la PyME.
- Testnet y proveedores externos quedan fuera del gate determinista; los checks PR usan dobles.
- No inventar estados, copy ni flujos que el template no diseñe sin decisión explícita del owner.
- No afirmar merge en `main` ni una rehearsal real de Testnet sin evidencia observada.

## Decisiones del owner

| # | Pregunta abierta del issue | Estado |
|---|---|---|
| D1 | ¿El admin puede inspeccionar PDFs, imágenes y fotos o sólo ver sus nombres? | **Resuelta (2026-10-06):** autorizado visor/descarga segura, con autorización admin, Storage privado y sin URLs públicas. |
| D2 | ¿Cómo se comunica «Pedir», «Requiere cambios» y «Rechazada» a la PyME? | **Resuelta (2026-10-06):** cada resultado se envía al correo registrado de la PyME y como notificación en la campana del header. Al abrirla, la app lleva al paso «Revisión humana» del wizard, donde se muestra el detalle accionable del pedido, los cambios requeridos o el rechazo. Se reutiliza #382 para email/campana; no se inventa una ruta nueva. |
| D3 | ¿Qué estados y acciones expone el review durante/después del deployment? | **Resuelta (2026-10-06):** `Pendiente de confirmación` → `Desplegando bóveda` → `Bóveda confirmada / PyME publicada`. Un fallo muestra `Despliegue fallido`, permite **Reintentar** y ofrece **Ver detalle** en modo solo lectura. La publicación ocurre sólo después de la confirmación de Testnet. |
| D4 | ¿Qué controla «Límite aprobado» y quién define deadline/mínimo de contribución? | **Resuelta (2026-10-06):** el admin no ingresa ni modifica límites; la PyME define los términos del proyecto durante el registro. La plataforma impone un máximo de USD 50.000 equivalentes por campaña y un máximo por inversor igual al menor de 10% del objetivo y USD 5.000 equivalentes. |

## Tareas

- [x] **T0 — Resolver preguntas abiertas.** D1–D4 resueltas antes de implementar los flujos afectados.
- [ ] **T1 — Revisión admin.** Contexto de solicitud, viewer privado, KYC/KYB por documento, assessment consultivo y decisión con validación/confirmación.
- [ ] **T2 — Persistencia y auditoría.** Decisión atribuida al admin autenticado, transiciones condicionales e idempotencia.
- [ ] **T3 — Aprobación y vault.** Vincular la public key persistida, validar los términos de la PyME contra los topes duros y la regla anti-concentración, llamar al engine existente de `POST /campaigns`, evitar redeploy en replay y publicar sólo tras confirmación. Exponer `Pendiente de confirmación` → `Desplegando bóveda` → `Bóveda confirmada / PyME publicada`, más `Despliegue fallido`, **Reintentar** y **Ver detalle** solo lectura.
- [ ] **T4 — Notificaciones y fallos.** Implementar email al correo registrado y notificación en la campana para pedido, cambios requeridos, rechazo y aprobación; al abrirla, navegar al paso «Revisión humana» con el detalle correspondiente. Resolver además los estados pending/failure sin sobreafirmar resultados.
- [ ] **T5 — Verificación y evidencia.** Suites deterministas, boundaries, evidencia en español y cierre manual de #411/#412/#413/#410.

## Checks aplicables

- `pnpm --filter @vaqcrow/api test`
- `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run build`
- `pnpm run boundaries`
- `pnpm run test:boundaries`
- `pnpm run test:db` cuando una migración cambie el esquema; primero local docker y luego remoto según la política del repositorio.

## Próximo paso

Arrancar T1 con los límites como reglas de dominio/configuración y con enforcement server-side atómico.

## Guardrails adoptados

- El producto actual es **revenue share**, no acciones ni bonos; no se debe presentar la demo como una emisión de valores negociables.
- La PyME define el objetivo, deadline y mínimo durante el registro; la plataforma valida que el objetivo no supere **USD 50.000 equivalentes** mediante el tipo de cambio simulado/configurado de la demo.
- Un inversor no puede superar el menor de **10% del objetivo de la campaña** y **USD 5.000 equivalentes**. Así una sola persona nunca puede comprar el 100% del proyecto; con un objetivo de USD 50.000, el máximo individual sería USD 5.000.
- El límite debe aplicarse server-side y de forma atómica al reservar/aplicar aportes; la UI sólo lo comunica. El contrato o engine debe rechazar también cualquier aporte que lo exceda.
- Estos números son una política conservadora de demo, no asesoramiento legal ni una afirmación de que sean los límites regulatorios aplicables al revenue share. La normativa argentina distingue crowdfunding de valores negociables y exige clasificación legal antes de producción.
