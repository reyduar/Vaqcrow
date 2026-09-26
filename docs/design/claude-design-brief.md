# Vaqcrow — Brief de diseño para Claude Design

> **Qué es este documento.** El brief autocontenido para generar un **template nuevo** de Vaqcrow con
> estética fintech moderna, consumible por Claude Design (o cualquier herramienta de diseño asistido).
> Deriva de [`demo-ui.md`](./demo-ui.md), que sigue siendo la fuente de verdad del sistema actual y el
> registro histórico del proyecto de Stitch; este documento no lo reemplaza. A diferencia de ese,
> **cubre los 19 flujos del producto** (no solo las 6 pantallas de la demo) y no depende de Stitch.

> [!info] Cómo leerlo
> §2 da contexto de producto, §3 la dirección estética, §4 el sistema a generar, §5 las **19 vistas**,
> §6 las restricciones que son **decisión de producto y no de gusto**, §7–§8 accesibilidad y temas,
> §10 los prompts listos para pegar. Si vas directo a la acción: §10 primero, §6 antes de aprobar.

---

## 1. Cómo usar este brief

1. **Pegar el prompt maestro (§10.1)** como instrucción de sistema o primer mensaje. Establece marca,
   tokens, restricciones y prohibiciones.
2. **Pedir el sistema antes que las pantallas:** primero tokens + escala tipográfica + componentes base
   (§4), y aprobarlos. Sin eso, cada pantalla inventa su propia verdad visual.
3. **Generar por flujo** con la plantilla de §10.2, una vista por vez, en el orden de §5.
4. **Revisar contra §6 antes de aprobar cualquier pantalla.** Las reglas de confianza no son
   preferencia visual: son el contrato de honestidad de la demo.
5. **Generar la matriz completa de §9** (claro/oscuro × escritorio/móvil) antes de dar el template por
   terminado.

Idioma: **los prompts van en inglés** (como los del corpus existente) y **toda la copia visible de la
interfaz debe quedar en español neutral de Argentina**, sin lunfardo ni regionalismos.

---

## 2. Qué es Vaqcrow (y qué no es)

### 2.1 El producto

Vaqcrow es una plataforma argentina de **financiamiento de PyMEs por revenue share**: una PyME formal
con ventas verificables obtiene capital flexible y lo devuelve como una participación contractual en
sus ingresos. El inversor aporta a una campaña y sigue la evidencia.

El dinero de la campaña **no se liquida como un pago directo**: cada campaña abre una **bóveda en un
contrato de Stellar (Soroban)**. El aporte queda custodiado por el contrato; nadie —ni Vaqcrow ni la
PyME— tiene una clave para moverlo. Al alcanzar la meta, el contrato liquida a la PyME en la misma
transacción; si vence sin alcanzarla, habilita el reembolso, que es *permissionless* pero **no se
dispara solo**. La distribución de revenue share sigue el camino clásico de Stellar (`@stellar/stellar-sdk`,
Horizon, firma con Freighter).

La evaluación de IA es **real y explicable** pero **consultiva**: organiza evidencia, marca anomalías y
propone una evaluación. No aprueba, no calcula obligaciones financieras, no firma y no mueve fondos. La
aprobación es humana y siempre atribuida.

### 2.2 La demo y sus límites honestos

Vaqcrow es hoy una **demo de dos semanas** construida como Trabajo Fin de Máster. El template debe
hacer legible, no solo posible, esta lista de límites:

- Identidad, KYC/KYB, ventas y conversión ARS/activo Stellar son **sintéticos**.
- Todo ocurre en **Stellar Testnet** con activos **sin valor económico**.
- La firma es **no custodial** (Freighter); Vaqcrow nunca recibe seeds.
- La IA es **advisory** y bajo supervisión humana.
- **No apto para producción**: no hay oferta de inversión, aprobación regulatoria, garantía de
  rentabilidad, solvencia ni operación real en Argentina.

### 2.3 Actores

| Actor | Qué hace en el producto | Qué necesita ver primero |
|---|---|---|
| **PyME** | Se registra, aporta evidencia, abre la bóveda y firma la distribución | Su estado de fondeo y qué le van a cobrar |
| **Inversor** | Explora el marketplace, evalúa riesgo, aporta a una campaña, sigue su portafolio | Riesgo, destino del dinero, cuándo puede retirar |
| **Operador / compliance** | Revisa solicitudes, decide, administra PyMEs y usuarios | Evidencia, trazabilidad, quién decidió qué y cuándo |
| **Evaluador / visitante** | Recorre la demo y lee los límites | Qué es real y qué es simulado |

---

## 3. Dirección de diseño: fintech moderna

### 3.1 La dirección en una frase

**Un producto financiero serio, contemporáneo y data-forward: alta jerarquía tipográfica, superficies
limpias limitadas por bordes en vez de sombras, un único acento usado con avaricia, números tratados
como protagonistas y microinteracciones que confirman sin festejar.**

### 3.2 Qué significa "moderna" acá

| Rasgo | Cómo se materializa |
|---|---|
| Jerarquía fuerte | Escala tipográfica amplia y pesos decididos; el orden de lectura se resuelve con tamaño, peso y espacio, no con color |
| Densidad controlada | Resumen compacto → detalle progresivo; nada de dashboards que muestran todo a la vez |
| Superficies honestas | Superficie + borde de 1 px; una sola elevación real, reservada a diálogo/drawer |
| Acento escaso | El acento aparece en la acción primaria, el foco y un dato clave por vista; nunca decora |
| Números protagonistas | Montos y porcentajes en cifras tabulares, alineados a la derecha, con etiqueta arriba |
| Estado como chip | Icono + título + texto; el color acompaña, nunca informa solo |
| Tipografía de sistema | Una sola familia sans, bien escalada; sin fuentes decorativas |
| Movimiento discreto | 150–220 ms para hover, expansión y cambio de estado; `prefers-reduced-motion` respetado |

### 3.3 Referencias de dirección (no de copia)

Como *calibración de tono*, no como plantilla a imitar: **Mercury / Ramp** (fintech B2B sobria y
precisa), **Linear** (jerarquía tipográfica y densidad disciplinada), **Stripe Dashboard** (datos,
tablas y estados legibles), **Wise** (claridad de costos y límites).

Lo que se toma de ellas es **el criterio**, no el layout: nada de copiar componentes ni de adoptar su
paleta.

### 3.4 Qué NO es esta dirección

> [!warning] Prohibiciones de la dirección (heredadas de las reglas de confianza)
> Nada de: estética de casino o cripto especulativa, **neón**, **gradientes intensos**, **glassmorphism**
> que reduzca contraste, confeti, monedas flotantes, fotos de dinero o de riqueza, flechas siempre
> ascendentes, medidores decorativos (gauges), dashboards genéricos con KPIs ornamentales, sombras
> pesadas ni animación ornamental. Tampoco **verde como único indicador de éxito**.

El motivo no es estético: la demo **no puede parecer una oferta financiera especulativa**. Esa es una
regla de producto (ver §6.1) y prevalece sobre cualquier preferencia visual.

---

## 4. Sistema a generar

Pedí primero el sistema, aprobalo, y recién después las pantallas. Estos valores son el punto de
partida autoritativo; se puede **evolucionar el tratamiento** (superficies, bordes, elevación, tintes de
estado) manteniendo el acento de marca.

### 4.1 Tokens de color

**Tema claro**

| Token | Valor | Uso |
|---|---:|---|
| `--color-brand-accent` | `#8A05BE` | Acción primaria, progreso y foco intencional |
| `--color-bg-canvas` | `#FFFFFF` | Fondo principal |
| `--color-bg-surface` | `#F5F5F5` | Tarjetas y superficies agrupadas |
| `--color-text-primary` | `#111111` | Texto principal |
| `--color-text-secondary` | `#666666` | Texto secundario |

**Tema oscuro**

| Token | Valor | Uso |
|---|---:|---|
| `--color-brand-accent` | `#8A05BE` | Igual uso; validar contraste por contexto |
| `--color-bg-canvas` | `#111111` | Fondo |
| `--color-bg-surface` | `#1F1F1F` | Superficie principal |
| `--color-bg-surface-raised` | `#272727` | Superficie elevada |
| `--color-text-primary` | `#FFFFFF` | Texto principal |
| `--color-text-secondary` | `#A0A0A0` | Texto secundario |

Tokens de apoyo (borde, foco, estados, riesgo, red/demo, datos) y sus variantes claro/oscuro están
especificados en [`demo-ui.md` §5.4](./demo-ui.md). Regla: **ningún estado depende solo del color**;
los valores de estado son decisiones de diseño, **no una certificación de contraste**.

> [!important] Los valores centrales no se ajustan en silencio
> Si una combinación falla contraste, se cambia la **combinación, el peso, el tamaño o el rol** del
> color y se documenta; no se deforma el token para que "pase".

### 4.2 Tipografía

Una sola familia sans. Recomendada: **Inter** (o una alternativa contemporánea equivalente con cifras
tabulares reales), sujeta a confirmar licencia y entrega web.

| Rol | Escritorio | Móvil | Peso / interlineado |
|---|---:|---:|---|
| Display | 56 px | 40 px | 700 / 1.05 |
| H1 | 40 px | 32 px | 700 / 1.15 |
| H2 | 30 px | 26 px | 700 / 1.2 |
| H3 | 22 px | 20 px | 650–700 / 1.3 |
| Body large | 18 px | 18 px | 400 / 1.55 |
| Body | 16 px | 16 px | 400 / 1.5 |
| Label | 14 px | 14 px | 600 / 1.35 |
| Caption | 12 px | 12 px | 500 / 1.4 |
| Dato monetario | 28–36 px | 24–30 px | 700, tabular |

- Máximo de 68–76 caracteres por línea de lectura.
- Cifras tabulares obligatorias en montos, porcentajes, fechas parciales y hashes abreviados.
- Sin versales sostenidas salvo badges cortos (`SIMULADO`, `TESTNET`, `DEMO`).

### 4.3 Espaciado, grilla y geometría

- Escala base de 4 px: `4, 8, 12, 16, 24, 32, 48, 64, 96`.
- Escritorio: contenedor máximo 1200 px, 12 columnas, gutter 24 px, margen mínimo 32 px.
- Tablet: 8 columnas, gutter 20 px, margen 24 px. Móvil: 4 columnas, gutter 16 px, margen 16 px.
- Radios: control 10 px, tarjeta 16 px, panel destacado 24 px, badge 999 px.
- Bordes: 1 px para límites y estados; 2 px para foco o selección.
- Sombra: **una sola** y solo en diálogo/drawer o superficie elevada; el resto usa borde o diferencia de fondo.
- Áreas táctiles mínimas: 44 × 44 px.

### 4.4 Iconografía, datos, imágenes y movimiento

- **Iconos:** un set único de trazo simple, a 20/24 px, geometría consistente. Combinar icono + texto +
  semántica accesible. No usar logos de activos como sustitutos de etiquetas.
- **Visualización:** un solo gráfico necesario (ventas mensuales, línea o barras) con el período
  faltante y la anomalía marcados, más su tabla accesible equivalente. Riesgo como banda textual
  (`Bajo`/`Medio`/`Alto`) y confianza numérica, **nunca** como gauge decorativo.
- **Imágenes:** fotografía documental sobria o ilustración geométrica simple, siempre rotulada como
  representativa/sintética. Evitar personas identificables, documentos reales o material que parezca
  evidencia KYC.
- **Movimiento:** 150–220 ms, easing suave; el polling usa un indicador discreto con texto.

### 4.5 Inventario de componentes

**Primitivas:** botón (primario, secundario, ghost, destructivo, enlace), input (texto, monto,
porcentaje, textarea), badge (`SIMULADO`, `TESTNET`, `DEMO`, riesgo, transacción, evidencia), card
(estándar, seleccionable, destacada, estado), link (interno, externo/explorador, copiar), tooltip (solo
ayuda no crítica), divider, spinner/skeleton con etiqueta accesible.

**Compuestos:** encabezado de entorno (marca + `DEMO` + `TESTNET` + caso/paso), banner de confianza
(simulación, Testnet, respaldo, error), progreso del proyecto (monto, fondeado, porcentaje; **nunca**
retorno estimado), stepper, timeline (procesando/enviado/confirmado/fallido), panel de evidencia
(disponible, faltante, anómala, inválida, simulada), evaluación de IA, decisión humana, wallet connect,
revisión de invocación/transacción, estado de transacción, toast/banner, amount input, tabla accesible,
gráfico de ventas.

El inventario completo con estados críticos está en [`demo-ui.md` §7](./demo-ui.md).

### 4.6 Patrones de experiencia

- **Resumen → evidencia → acción:** toda decisión crítica abre con una síntesis y permite profundizar.
- **Trust strip persistente:** `TESTNET` (+ `SIMULADO` cuando aplica) visible en cada punto de decisión.
- **Revisión antes de firmar:** ninguna acción abre Freighter sin intención legible y confirmación explícita.
- **Proceso asíncrono recuperable:** URL estable, énfasis en que enviado ≠ confirmado, acción segura de reintento.
- **Comparación IA/persona:** recomendación y decisión humana en bloques separados, con autor y timestamp.
- **Cálculo auditable:** entradas + regla versionada + redondeo + resultado; sin texto generativo en el cálculo.

---

## 5. Inventario de vistas (19 flujos)

### 5.1 Cómo está agrupado

| Área | Flujos |
|---|---|
| Onboarding y acceso | 1 Onboarding · 2 Onboarding PyME: KYC |
| Landing y marketplace | 3 Landing · 4 Marketplace · 5 Marketplace con filtros avanzados |
| PyME: registro, detalle, tokenización | 6 Registro · 7 Detalle · 8 Tokenización |
| Portafolio, billetera, informes | 9 Portafolio · 10 Billetera · 11 Informes |
| Soporte y notificaciones | 12 Notificaciones · 13 Centro de ayuda · 14 Guía de inversión · 15 Guía para emprendedores |
| Administración | 16 Admin — PyMEs · 17 Admin — Revisión de solicitud · 18 Admin — Usuarios |
| Institucional | 19 Acerca de Vaqcrow |

> [!note] Estado de especificación
> Hoy **sólo los 6 flujos heredados de la historia vertical** tienen ficha detallada y prompt (los
> marcados «heredada» abajo). Los otros 13 quedan especificados por primera vez **en este brief**: es
> exactamente el hueco que este documento viene a cerrar.

### 5.2 Estado implementado hoy (para no confundir diseño con realidad)

En código existen hoy **7 páginas**: `/` y las 6 rutas de la demo (`/request`, `/ai-assessment`,
`/approval`, `/funding`, `/distribution`, `/evidence`). No coinciden 1:1 con los 6 flujos heredados del
mapa de Stitch: la implementación resolvió un recorrido de 6 pasos —solicitud → evaluación de IA →
aprobación humana → fondeo por bóveda → distribución → evidencia— y las fichas de diseño con rutas
`/demo/*` son anteriores. El template nuevo debe **unificar esa nomenclatura** (ver §12, pregunta 2).

### 5.3 Fichas por flujo

Cada ficha es la unidad de generación de §10.2. «Heredada» significa que además tiene especificación
detallada en [`demo-ui.md` §8](./demo-ui.md).

#### 1 · Onboarding — `/onboarding`
- **Actor:** persona nueva. **Propósito:** entender la propuesta y crear/activar la cuenta.
- **Contenido clave:** hero corto; los 4 pasos del modelo (PyME → evaluación → bóveda → distribución); trust strip; CTA primario.
- **Estados:** nuevo · validación en curso · cuenta creada · error de red.
- **Límite:** sin autenticación real; Auth.js de producción está fuera de alcance.

#### 2 · Onboarding PyME: KYC — `/onboarding/pyme/kyc`
- **Actor:** PyME. **Propósito:** completar KYC/KYB **simulado** para poder registrar la PyME.
- **Contenido clave:** pasos del formulario; carga de documentos sintéticos; estado de verificación; badge `SIMULADO` contiguo a cada dato.
- **Estados:** sin empezar · enviado · aprobado · requiere cambios.
- **Copys obligatorios:** «Resultado simulado para esta demo; no constituye una verificación de identidad» y `KYC aprobado · SIMULADO`.

#### 3 · Landing — `/`
- **Actor:** visitante/inversor. **Propósito:** entender la propuesta general y navegar a marketplace u onboarding.
- **Contenido clave:** hero en dos columnas; badges `DEMO` / `TESTNET` / `DATOS SIMULADOS`; una sola oportunidad destacada; «cómo funciona»; enlace visible a los límites de la demo.
- **Estados:** visitante · con caso destacado · sin caso.
- **Límite:** no mostrar métricas de marketplace ni retorno esperado.

#### 4 · Marketplace — `/marketplace`
- **Actor:** inversor. **Propósito:** explorar varias oportunidades de PyMEs sintéticas.
- **Contenido clave:** grilla de cards (sector, ubicación, objetivo, progreso monto+porcentaje, banda de riesgo) con badge `SIMULADO` por card; orden por defecto explícito.
- **Estados:** cargando · con resultados · vacío · error.

#### 5 · Marketplace con filtros avanzados — `/marketplace` (modo filtros)
- **Actor:** inversor. **Propósito:** acotar por sector, riesgo, monto y plazo.
- **Contenido clave:** panel de filtros; chips de filtros activos con quitar; contador de resultados; acción de limpiar.
- **Estados:** filtros aplicados · sin resultados (con sugerencia de relajar) · cargando.

#### 6 · Registro de PyME — `/request` *(heredada)*
- **Actor:** PyME. **Propósito:** enviar solicitud y evidencia sintética.
- **Contenido clave:** perfil de la empresa, KYC, tabla de ventas con período faltante y anomalía, cada dato con badge `SIMULADO`.
- **Estados:** vacío · completo · inválido · enviado.
- **Detalle completo:** [`demo-ui.md` §8 Pantalla 2](./demo-ui.md).

#### 7 · Detalle de PyME — `/marketplace/[pymeId]`
- **Actor:** inversor/evaluador. **Propósito:** revisar evidencia, riesgo y evaluación de una PyME puntual.
- **Contenido clave:** resumen del caso; panel de evidencia (fuente, extracto, procedencia); banda de riesgo + confianza; recomendación de IA y decisión humana **separadas**; CTA para aportar.
- **Estados:** cargando · sin evaluación todavía · evaluada · aprobada · requiere cambios.

#### 8 · Tokenización de PyME — `/marketplace/[pymeId]/tokenizacion`
- **Actor:** PyME/operador. **Propósito:** definir y visualizar el financiamiento de la campaña.
- **Contenido clave:** meta, fecha límite, porcentaje de revenue share, unidad mínima, regla versionada; **destino de la liquidación fijado por el contrato e inmutable**; enlace al contrato en el explorador.
- **Estados:** borrador · publicada · meta alcanzada · en reembolso.
- **Límite:** sin retorno garantizado ni probabilidad de éxito.

#### 9 · Portafolio — `/evidence` *(heredada)*
- **Actor:** inversor/PyME. **Propósito:** auditar cálculo, firmar distribución y verificar hashes de las posiciones.
- **Contenido clave:** timeline integral; feed mensual `SIMULADO`; cálculo con entradas, regla, redondeo y total; tarjetas de evidencia con hash y explorador.
- **Estados:** vacío · parcial · completo · pendiente.
- **Detalle completo:** [`demo-ui.md` §8 Pantalla 6](./demo-ui.md).

#### 10 · Billetera — `/funding` *(heredada)*
- **Actor:** inversor/PyME. **Propósito:** conectar Freighter, revisar la invocación de la bóveda y firmar sin custodia.
- **Contenido clave:** estado de la bóveda (`Fondeo abierto` / `Meta alcanzada` / `Reembolso disponible`); meta, total, fecha límite y aporte propio; revisión de la invocación; controles `Aportar` / `Retirar mi aporte` / `Reembolsar`.
- **Estados:** desconectada · conectada · firmando · enviado (no confirmado) · error.
- **Detalle completo:** [`demo-ui.md` §8 Pantalla 4](./demo-ui.md).

#### 11 · Informes — `/informes`
- **Actor:** inversor/PyME/evaluador. **Propósito:** consultar reportes agregados de actividad y desempeño simulado.
- **Contenido clave:** rango de fechas; KPIs con etiqueta de origen y estado; serie de actividad; tabla accesible; exportación (o su ausencia explicada).
- **Estados:** vacío (sin datos del período) · cargando por bloque · error parcial · listo.
- **Límite:** toda cifra rotulada como simulada; sin proyección de retorno.

#### 12 · Notificaciones — `/notificaciones`
- **Actor:** cualquiera autenticado. **Propósito:** revisar avisos de estado, cambios y confirmaciones.
- **Contenido clave:** agrupación por fecha; leído/no leído perceptible **sin depender del color**; enlace al objeto del aviso; estado vacío útil.
- **Estados:** sin leer · todo leído · vacío · cargando.

#### 13 · Centro de ayuda — `/ayuda`
- **Actor:** cualquiera. **Propósito:** resolver dudas frecuentes sobre la demo y el producto.
- **Contenido clave:** buscador; categorías; preguntas desplegables; contacto; aviso de que la demo no es asesoramiento legal ni financiero.
- **Estados:** resultados · sin resultados (con sugerencia) · cargando.

#### 14 · Guía de inversión — `/guias/inversion`
- **Actor:** inversor. **Propósito:** entender cómo evaluar e invertir en una PyME sintética.
- **Contenido clave:** qué es el revenue share; qué se puede perder; cómo leer riesgo, evidencia y cálculo; glosario.
- **Estados:** lectura (con índice de progreso); sin estados de datos.
- **Límite:** educativo; nunca recomendación de inversión.

#### 15 · Guía para emprendedores — `/guias/emprendedores`
- **Actor:** PyME. **Propósito:** entender cómo registrar y financiar su PyME.
- **Contenido clave:** requisitos; qué evidencia preparar; cómo funciona la bóveda y el reembolso; qué no garantiza la plataforma.
- **Estados:** lectura; sin estados de datos.

#### 16 · Admin — Gestión de PyMEs — `/admin/pymes`
- **Actor:** operador. **Propósito:** administrar el catálogo de PyMEs registradas.
- **Contenido clave:** tabla con estado, sector, fecha y último cambio; filtros; acciones por fila con confirmación; densidad más alta que el producto público.
- **Estados:** cargando · vacío · error · acción en curso.

#### 17 · Admin — Revisión de solicitud — `/approval` *(heredada)*
- **Actor:** operador. **Propósito:** obtener la evaluación de IA y registrar la aprobación humana.
- **Contenido clave:** evaluación estructurada (banda, confianza, razones, anomalías, faltantes, preguntas); panel de decisión humana con actor, razón, límite y timestamp; límite permitido.
- **Estados:** procesando · evaluación válida · inválida · timeout · respaldo · requiere cambios · aprobada · rechazada.
- **Detalle completo:** [`demo-ui.md` §8 Pantalla 3](./demo-ui.md).

#### 18 · Admin — Usuarios — `/admin/usuarios`
- **Actor:** operador. **Propósito:** administrar personas usuarias y roles.
- **Contenido clave:** tabla de usuarios con rol y estado; invitación; cambio de rol con confirmación explícita; registro de auditoría visible.
- **Estados:** cargando · vacío · error · cambio en curso.

#### 19 · Acerca de Vaqcrow — `/acerca-de`
- **Actor:** visitante. **Propósito:** consultar misión, visión, pilares de valor y presentación del creador.
- **Contenido clave:** hero de producto; misión y visión; pilares de valor; sección condensada del creador; contacto/footer.
- **Estados:** lectura; sin estados de datos.

---

## 6. Restricciones no negociables (producto, no estética)

> [!danger] Prevalecen sobre cualquier preferencia visual
> [`demo-ui.md` §2](./demo-ui.md) es explícito: estas reglas **prevalecen sobre cualquier preferencia
> visual o simplificación de demo**. El template puede ser todo lo moderno que quieras; no puede
> aflojar estas reglas. Si querés cambiar alguna, es una decisión de producto del owner, no un ajuste
> de diseño.

### 6.1 Reglas de confianza

| Regla | Aplicación en interfaz | Criterio de rechazo |
|---|---|---|
| Testnet persistente | Badge `TESTNET` en el encabezado fijo y contexto de red en cada revisión/transacción | Una pantalla transaccional no indica la red o parece operar con dinero real |
| Simulación explícita | Badge `SIMULADO` **contiguo** al origen sintético | La etiqueta depende de tooltip, color, pie de página o explicación oral |
| IA consultiva | «La IA recomienda; una persona decide»; acción humana separada y atribuida | Un botón o estado implica aprobación automática |
| Custodia | Antes de firmar: «Freighter firma; Vaqcrow nunca recibe tu seed». **Durante la campaña, los aportes los custodia el contrato de la bóveda, no una persona** | Se pide una seed o se sugiere que la persona custodia los fondos |
| Pendiente no es confirmado | `Enviado`/`Pendiente de confirmación` **nunca** usa iconografía o tono de éxito | La respuesta de envío se muestra como liquidación final |
| Sin garantías | Usar «estimado», «simulado» y «riesgo» | Se promete retorno, aprobación, solvencia o disponibilidad productiva |
| Real versus simulado | Cada evidencia y movimiento declara su naturaleza **en el punto de decisión** | La persona debe inferir qué parte es real |
| Trazabilidad | Actor, fecha, regla/modelo, correlation ID, hash y fuente visibles cuando correspondan | Una decisión o transacción crítica carece de referencia verificable |

### 6.2 Disclosures canónicos (mostrar completos donde corresponda)

Estos seis textos se muestran **verbatim**, sin abreviar, en la aplicación:

> **Demostración con datos simulados.** La identidad, el KYC/KYB, las ventas y la conversión ARS/activo Stellar de este caso son sintéticos. No representan verificaciones ni movimientos de dinero real.

> **Stellar Testnet.** Las transacciones mostradas usan activos sin valor económico en Stellar Testnet. Un hash de Testnet demuestra ejecución técnica, no una inversión real ni disponibilidad en producción.

> **Firma no custodial.** Freighter es la wallet e interfaz de firma. La persona usuaria conserva sus claves; Vaqcrow construye y verifica la transacción y nunca recibe su seed.

> **Custodia por contrato.** Durante la campaña, los aportes los custodia el contrato, no una persona: nadie tiene una clave para moverlos. El contrato sólo puede pagar al destino fijo definido al abrir la bóveda, y ese destino es inmutable. La meta la evalúa el contrato sobre el ledger y, al alcanzarla, liquida a la PyME en la misma transacción. No hay recuperación ni clawback: no existe forma de revertir un pago ya liquidado, y los fondos que nadie reclame sólo pueden salir por el barrido; si no, pueden quedarse en el contrato. El reembolso por vencimiento no se dispara solo: exige que alguien envíe la transacción, y es permissionless porque el destino ya está fijado.

> **IA con supervisión humana.** La IA organiza evidencia, identifica anomalías y propone una evaluación explicable. No inventa datos, no toma la decisión final, no calcula obligaciones financieras y no transfiere fondos.

> **No apto para producción.** Esta demo no constituye una oferta de inversión, recomendación financiera, aprobación regulatoria ni prueba de legalidad, rentabilidad, solvencia, custodia, calidad de proveedores u operación en Argentina.

**Microcopy obligatorio:** `TESTNET · Activos sin valor económico` · `SIMULADO` · `Activo de prueba sin valor económico` · «Esta decisión la registra una persona. La recomendación de IA no aprueba ni transfiere fondos.» · «La transacción fue enviada, pero todavía no está confirmada» · «Cálculo determinístico; la IA no calcula esta obligación» · «Resultado simulado para esta demo; no constituye una verificación de identidad» · «Serie sintética y reproducible; abril está ausente y junio contiene una anomalía intencional».

### 6.3 Términos prohibidos o condicionados

| Evitar | Usar |
|---|---|
| `Inversión segura`, `rentabilidad garantizada` | `Demostración`, `estimación`, `revenue share sujeto a riesgo` |
| `Aprobado por IA` | `Recomendado por IA; aprobado por [actor]` |
| `Dinero depositado` al enviar | `Transacción enviada; pendiente de confirmación` |
| `KYC verificado` sin contexto | `KYC aprobado · SIMULADO` |
| `Wallet de Vaqcrow` | `Freighter conectada de forma no custodial` |
| `Pago real` | `Transacción real en Testnet con activo sin valor económico` |
| `Retorno` como certeza | `Distribución calculada para este período simulado` |

---

## 7. Accesibilidad

**Objetivo: WCAG 2.2 nivel AA en el recorrido crítico.**

- Contraste mínimo 4.5:1 en texto normal, 3:1 en texto grande y en componentes/bordes significativos/foco.
- **Medir**, no asumir: cada pareja `surface`/`text`/`icon` de ambos temas, más hover, focus, disabled y visited.
- Tabulación en orden visual; revisión, wallet, firma y recuperación completables sin mouse.
- Foco visible de 2 px; no retirar `outline` sin reemplazo equivalente.
- Label persistente por campo; ayuda y errores asociados programáticamente; resumen de errores recibe foco al enviar.
- Estados con icono + título + texto; nunca solo color, posición o animación.
- Cambios `submitted`/`confirmed`/`failed` anunciados con región viva moderada, sin repetir en cada polling.
- Diálogos de Freighter: foco inicial predecible, trampa de foco, cierre con `Escape` cuando sea seguro, retorno del foco al disparador.
- Botones deshabilitados conservan explicación visible del requisito pendiente (no solo tooltip).
- Enlaces al explorador indican que abren nueva pestaña y exponen el hash completo en su nombre accesible.
- Zoom 200 %, reflow a 320 CSS px, `prefers-reduced-motion` y `prefers-contrast` respetados.

---

## 8. Responsive y temas

- Diseñar primero a **1440 × 1024** y validar a **1280 × 800**; móvil a **390 × 844** con reflow a 320 px.
- Tablet reorganiza columnas pero **conserva el resumen de decisión antes del detalle**.
- Móvil apila; la acción primaria puede fijarse al borde inferior **solo si no oculta disclosures**; las tablas pasan a listas etiquetadas.
- Hashes y datos largos: bloque con salto seguro, abreviación visual y acción `Copiar`, con el valor completo accesible.
- **Claro y oscuro son entregables obligatorios** para los 19 flujos, en escritorio y móvil; ninguno se degrada.
- Selector visible `Claro` / `Oscuro` / `Sistema`, operable por teclado, con estado seleccionado perceptible sin depender del color.
- El tema efectivo se aplica **antes del primer paint** (sin flash engañoso); fallback determinístico a claro si el almacenamiento o JS fallan.
- Cambiar de tema no reinicia formularios, wallet, estado transaccional ni foco.

---

## 9. Entregables y matriz de generación

Por cada flujo, el template está terminado cuando existen y están aprobadas:

| Entregable | Cantidad |
|---|---|
| Escritorio claro | 19 |
| Escritorio oscuro | 19 |
| Móvil claro | 19 |
| Móvil oscuro | 19 |
| **Total de pantallas** | **76** |

Más, como piezas transversales: **sistema de tokens** (color, tipografía, espaciado, radios, sombras),
**inventario de componentes** con sus estados, y **estados de sistema** (vacío, carga, error,
deshabilitado, éxito, pendiente) documentados una vez y reutilizados.

---

## 10. Prompts listos para usar

### 10.1 Prompt maestro

```text
Design a coherent high-fidelity product template for “Vaqcrow”, an Argentine revenue-share financing
platform. This is a two-week demo built as the final project (TFM) of a Master's in AI Development —
NOT a production financial product. The template must be honest about that, not hide it.

DIRECTION
A modern fintech interface: data-forward, precise, sober, self-confident. Strong typographic hierarchy,
controlled density, progressive disclosure. Surfaces are delimited by 1px borders and background tint,
not by heavy shadows; exactly one elevation level exists, reserved for dialogs and drawers. A single
accent colour is used sparingly, for the primary action, focus and one key datum per view — never as
decoration. Money and percentages are protagonists: large tabular numerals, right-aligned, labelled
above. It should read like serious financial software (think Mercury, Ramp, Linear, Stripe Dashboard,
Wise) — take the criteria, do not copy their layouts or palettes.

NEVER
Casino or speculative-crypto aesthetics, neon, strong gradients, glassmorphism, confetti, floating
coins, money or wealth photography, ever-rising arrows, decorative gauges, ornamental KPI dashboards,
heavy shadows, ornamental animation, or green as the only signal of success. The demo must never look
like a speculative investment offer.

CONTEXT THE UI MUST MAKE LEGIBLE
- Identity, KYC/KYB, sales data and ARS/Stellar conversion are SIMULATED. Testnet assets have no
  economic value. Not fit for production; no investment offer, no regulatory approval, no guaranteed
  return.
- Signing is non-custodial: the person keeps their keys and Vaqcrow never receives a seed.
- During a campaign, the contributions are held by a Stellar smart-contract vault — no person holds a
  key to those funds. The payout destination is fixed when the vault opens and is immutable. There is
  no recovery and no clawback, and the deadline refund is permissionless but never self-firing.
- The AI is advisory: it organises evidence, flags anomalies and proposes an explainable assessment.
  It never approves, never calculates financial obligations, never signs and never moves funds. A human
  decides, always attributed.
- Pending is never confirmed: “sent” must never look like settle.

DESIGN SYSTEM
Core colours (authoritative, do not substitute): brand accent #8A05BE; light theme canvas #FFFFFF,
surface #F5F5F5, text primary #111111, text secondary #666666; dark theme canvas #111111, surface
#1F1F1F, raised surface #272727, text primary #FFFFFF, text secondary #A0A0A0. You may evolve the
support treatment (borders, elevation, status tints) but keep the accent and design both themes.
Type: one sans family with real tabular numerals (Inter recommended). Scale — display 56/40, H1 40/32,
H2 30/26, H3 22/20, body large 18, body 16, label 14, caption 12; monetary figure 28–36 at weight 700
with tabular numerals.
Grid: 4px base scale (4/8/12/16/24/32/48/64/96); desktop max 1200px, 12 columns, 24px gutter; tablet
8 columns; mobile 4 columns. Radii: control 10, card 16, featured panel 24, badge pill 999. Touch
targets ≥44×44px.

STATUS, ALWAYS THREE CHANNELS
Every state pairs an icon, a title and text; colour accompanies, never informs alone. Reserve success
styling for actually confirmed outcomes only.

ACCESSIBILITY
Target WCAG 2.2 AA. Contrast ≥4.5:1 body, ≥3:1 large text and meaningful borders/focus. Visible 2px
focus ring. Persistent labels, programmatic error association, live regions for status changes that do
not repeat on every poll. Respect reduced motion, 200% zoom and 320px reflow.

LANGUAGE
All visible UI copy in professional neutral Spanish for Argentina — no slang, no regionalisms. Every
number, date and amount formatted for es-AR.

DELIVER
First the design system: tokens, type scale, spacing, and the component inventory with its critical
states. Then the template shell: fixed header with the brand, a DEMO badge and a TESTNET badge, primary
navigation, and a footer carrying the “No apto para producción” disclosure. Do not design every screen
yet; establish the system and the shell so every later view inherits one source of truth.
```

### 10.2 Plantilla por flujo

Concatenar el prompt maestro con **un** bloque por vista:

```text
SCREEN <n> — <Nombre del flujo>
Route: <ruta>
Actor: <actor principal>
Purpose: <para qué existe esta vista en una frase>
Key content: <3 a 6 bullets de contenido obligatorio>
Critical states: <vacío / carga / error / deshabilitado / éxito / pendiente, los que apliquen>
Boundaries: no investment advice, no guaranteed return, no production claim, no real money. Any
simulated datum carries a contiguous SIMULADO badge; the network context shows TESTNET.
TARGET_DEVICE: DESKTOP|MOBILE · TARGET_THEME: LIGHT|DARK
```

Las fichas de §5.3 llenan esta plantilla; no hay que inventar el contenido de cada vista.

### 10.3 Ediciones y variantes

- **Corrección acotada:** pedir un cambio puntual sobre una pantalla ya aprobada, sin regenerar el resto,
  y registrar qué cambió.
- **Variantes:** permitir como máximo una comparación acotada por pantalla (por ejemplo, dos tratamientos
  de la tabla de evidencia) y elegir una; no convertir la exploración en un catálogo.
- **No** usar variantes para esquivar una regla de §6.

---

## 11. Criterios de aceptación del template

- [ ] Existe un sistema de tokens aprobado (color, tipografía, espaciado, radios, elevación) y una sola fuente de verdad.
- [ ] El shell tiene encabezado fijo con marca + `DEMO` + `TESTNET` y footer con «No apto para producción».
- [ ] Los 19 flujos tienen ficha propia y pantalla generada, en la matriz completa de §9.
- [ ] Claro y oscuro están ambos diseñados y ninguno se degrada.
- [ ] Ningún estado depende solo del color; icono + título + texto en todos.
- [ ] Ningún texto de la interfaz promete retorno, aprobación, solvencia ni disponibilidad productiva.
- [ ] Cada dato sintético tiene `SIMULADO` contiguo; cada contexto transaccional indica `TESTNET`.
- [ ] Lo enviado nunca se ve confirmado.
- [ ] Contraste, foco, teclado, zoom 200 % y reflow a 320 px verificados.
- [ ] Los términos de §6.3 no aparecen en ningún texto visible.
- [ ] La copia visible está en español neutral de Argentina.

---

## 12. Preguntas abiertas para el owner

> [!question] Antes de generar
> 1. **¿El acento sigue siendo `#8A05BE`?** Es el color de marca actual. Se puede mantener y modernizar
>    todo el resto del tratamiento; cambiarlo es una decisión de marca.
> 2. **¿Unificamos la nomenclatura de rutas?** Hoy conviven las rutas implementadas (`/request`,
>    `/approval`, `/funding`, …) y las propuestas de diseño (`/demo/solicitud`, `/demo/evaluacion`, …).
>    El template debería fijar una sola y que el código la siga.
> 3. **¿La biblioteca de componentes cambia?** El sistema actual se apoya en HeroUI + Tailwind y React
>    Icons `io5`. Si el template propone otra base, hay que decidir si se migra o si el diseño se
>    restringe a lo implementable con la actual.
> 4. **¿`product.md` entra en el alcance visual?** Los 19 flujos son el producto completo; hoy sólo 6
>    están implementados y la demo es lo evaluable. Diseñar los 19 es legítimo, pero conviene saber si
>    el objetivo es el template completo o sólo el recorrido de la demo.
