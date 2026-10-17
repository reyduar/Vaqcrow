---
title: Cómo construimos Vaqcrow con gentle-ai y ODD
tags:
  - blog
  - gentle-ai
  - odd
  - agentes
  - desarrollo
---

# Cómo construimos Vaqcrow con gentle-ai y ODD

Vaqcrow no se escribió a mano línea por línea. Se construyó dirigiendo agentes de programación con IA —principalmente **Claude Code** y **OpenCode**— configurados con **gentle-ai**, un ecosistema de herramientas de código abierto creado por Alan Buscaglia, de [Gentleman Programming](https://gentlemanprogramming.com/). Este artículo cuenta qué es ese stack, cómo funciona su forma de trabajo, **ODD** (*Organic Driven Development*), y por qué dejó atrás a **SDD** (*Spec-Driven Development*), el flujo con el que este mismo proyecto arrancó.

> Lo que sigue describe gentle-ai según su documentación pública al **17 de octubre de 2026** (versión `v4.2.0`). Es una herramienta que cambia rápido: si algo no coincide, manda su documentación. Las cifras de rendimiento son las que publica el propio proyecto, no mediciones nuestras.

## Qué es gentle-ai

gentle-ai es un **configurador**: no es un agente nuevo ni instala uno por vos. Toma los agentes que ya tenés en tu máquina y les escribe, en su configuración nativa, un conjunto de prácticas de trabajo: memoria persistente, un flujo de desarrollo, una biblioteca de *skills*, servidores MCP, una persona y una revisión opcional del trabajo terminado.

Según su repositorio, se integra con **17 agentes**, entre ellos Claude Code, OpenCode, Codex, Cursor, Gemini CLI, Kiro y Pi. Es software libre con licencia MIT.

```sh
brew install gentleman-programming/tap/gentle-ai
gentle-ai install   # configura los agentes presentes en la máquina
gentle-ai sync      # vuelve a aplicar la configuración tras una actualización
gentle-ai doctor    # diagnostica la instalación
```

## Las cinco herramientas del ecosistema

| Herramienta | Qué hace |
|---|---|
| [**gentle-ai**](https://github.com/Gentleman-Programming/gentle-ai) | Configura los agentes: memoria, ODD, skills, MCP, persona y revisión. |
| [**Engram**](https://github.com/Gentleman-Programming/engram) | Memoria persistente para cualquier agente: un binario en Go con SQLite y búsqueda de texto completo, accesible por CLI, HTTP, MCP y una interfaz de terminal. |
| [**gentle-pi**](https://github.com/Gentleman-Programming/gentle-pi) | Convierte al agente Pi en un entorno de desarrollo controlado, con ODD, subagentes acotados y evidencia de tests. |
| [**GGA**](https://github.com/Gentleman-Programming/gentleman-guardian-angel) (*Gentleman Guardian Angel*) | Revisión de código con IA como *hook* de `pre-commit`, con el proveedor que ya uses. |
| [**Gentleman.Dots**](https://github.com/Gentleman-Programming/Gentleman.Dots) | Un instalador que deja el mismo entorno de terminal (Neovim, Tmux o Zellij, shell, prompt) en cualquier máquina. |

## Qué le agrega gentle-ai a tu agente

- **Memoria con Engram.** El costo de una sesión nueva no son los tokens: sos vos, explicando otra vez las mismas decisiones. Con Engram el agente anota lo que aprende —decisiones, bugs, convenciones— y lo consulta antes de preguntarte. La base local en SQLite es la fuente de verdad.
- **ODD**, el flujo de trabajo, que se explica abajo.
- **Skills**: instrucciones empaquetadas que el agente carga cuando la tarea las necesita, más las propias del proyecto.
- **Servidores MCP**, como Context7, que trae documentación actualizada de librerías y frameworks.
- **Una persona**: una voz de mentor («Gentleman»), una neutral o una propia.
- **Barandas de seguridad**: una lista de rutas que el agente no puede leer, como `~/.ssh` o los archivos `.env`.
- **RDD**, una revisión del trabajo terminado, que también se explica abajo.

## ODD: Organic Driven Development

La idea central de ODD entra en una frase de su documentación: **«Keep small work small»**. Un cambio chico no debería necesitar una línea de montaje de planificación, y un trabajo grande no debería perder su contexto entre una sesión y la otra.

### El protocolo, en siete pasos

ODD corre en **cada pedido**, sin que tengas que pedir un plan:

1. **Autorizar.** ¿El pedido autoriza un cambio? Explicar, investigar o revisar es de solo lectura: el agente no toca archivos.
2. **Explorar.** Leer el código y los requisitos existentes antes de proponer nada, en proporción al pedido.
3. **Resolver la incertidumbre.** Investigar sólo si hay una duda con nombre; hacer **una** pregunta sólo si hay una decisión de producto abierta, y esperar la respuesta.
4. **Clasificar.** ¿Es chico o grande? (ver abajo).
5. **Registrar antes de escribir.** Si es grande, crear el documento de la feature antes del primer cambio.
6. **Implementar tarea por tarea**, con tests primero cuando hay un test que tenga sentido.
7. **Cerrar** contando el resultado verificado y cada chequeo que falló o quedó pendiente.

### Chico o grande: la prueba de reanudar

ODD no mide el tamaño contando archivos. Una tarea es **chica** cuando se cumplen tres cosas:

- **Se entiende**: se sabe qué cambiar y dónde, y no queda una decisión abierta.
- **Su riesgo está acotado**: no toca datos guardados, seguridad, contratos que otros consumen, concurrencia ni la entrega.
- **Se puede reanudar con el diff**: si la sesión se cortara ahora, alguien podría terminarla leyendo sólo el pedido y `git diff`.

Una tarea chica se hace en línea, sin subagentes y sin documentos. Una tarea **grande** —la que no pasa la prueba de reanudar— recibe **un único documento**, `odd/tasks/<feature>.md`, con un orden fijo:

| Sección | Qué guarda |
|---|---|
| Encabezado | El objetivo, la rama y el *runner* de tests. |
| `## Specs` | Los requisitos numerados (`S1`, `S2`…), que **citan textual** lo que pidió la persona: sus frases, sus mensajes de error, sus ejemplos. |
| `## Tasks` | Una línea por tarea, con los `S#` que cubre, la ruta y el commit que la contiene. |
| `## Log` | La bitácora. La primera entrada es el pedido original, palabra por palabra. |

Ese documento tiene una copia en Engram, así que una sesión nueva retoma el trabajo sin reconstruir el plan.

### Delegar por una razón, no por tamaño

Un subagente cuesta una sesión nueva, lecturas sin caché y un traspaso de contexto. Por eso ODD sólo delega cuando puede **nombrar la razón**:

| Razón | Cuándo aplica |
|---|---|
| Exploración | Entender algo requiere más de una tanda de lecturas; un explorador devuelve un mapa corto con evidencia `archivo:línea`. |
| Escritores en paralelo | Hay dos o más unidades independientes, con archivos distintos, que valen el costo de arrancar un subagente. |
| Respaldo de contexto | Una sesión muy larga le pasa la siguiente unidad a un agente fresco. |
| Verificador independiente | El cambio toca un punto de alto riesgo. |

Y cuando delega, **no parafrasea**: le pasa al subagente una referencia al documento y a sus `S#`, para que lea el pedido original y no un resumen.

### Por qué así: lo que midieron

La documentación de gentle-ai publica estas corridas de su propio *benchmark*. Cada celda es **una sola corrida** (n=1), así que se leen como una señal, no como una ley:

| Escenario | Antes | Después |
|---|---|---|
| Bug de 3 líneas en una función | 335 s · 56 turnos · USD 0,339 | 77 s · 10 turnos · USD 0,105, en línea y sin subagentes |
| Bug en lógica compartida | 479 s · USD 0,361 | 276 s · USD 0,207, con un explorador |
| Spec de 73 líneas, 26 chequeos ocultos | Traspasos parafraseados: 13 fallas | Spec pasada por referencia |

## Por qué ODD dejó atrás a SDD

### Qué era SDD

**SDD** (*Spec-Driven Development*) organizaba cada cambio en fases con un artefacto por fase. Vaqcrow empezó así: el ciclo de un cambio tenía **siete artefactos** —exploración, propuesta, spec, diseño, tareas, progreso de la implementación y reporte de verificación—, guardados primero en una carpeta `openspec/` y, desde el 15 de septiembre de 2026, en Engram.

### Qué problema apareció

El *issue* [#4612](https://github.com/Gentleman-Programming/gentle-ai/issues/4612) de gentle-ai lo explica sin vueltas. SDD tenía que ayudar a acordar una implementación y conservar las especificaciones útiles, pero con el tiempo había sumado **un segundo sistema de gobierno de la ejecución**: tokens de intento, reportes de verificación obligatorios antes de archivar y protocolos de admisión antes de una propuesta. En sus palabras, esos mecanismos creaban lugares donde el trabajo útil **se bloqueaba por el estado del flujo**, no por un problema real de producto, de permisos o técnico. El *issue* enumera casos reportados: replanificaciones bloqueadas, evidencia circular y verificaciones duplicadas.

Esa propuesta planteaba aligerar SDD y dejarlo como guía opcional. La decisión final fue más radical. El *issue* [#4959](https://github.com/Gentleman-Programming/gentle-ai/issues/4959), cerrado el **25 de septiembre de 2026**, retiró SDD como flujo activo para que **ODD sea el único**. Su argumento: mantener SDD como opción seguía ofreciendo dos caminos de ejecución donde se buscaba uno.

### Qué se conservó

La especificación no desapareció: se mudó. En ODD, los requisitos viven en la sección `## Specs` del documento de la feature, **citados textualmente**, y cada traspaso apunta a ellos. Lo que se fue fue la burocracia de fases obligatorias. Se quedaron los tests primero, la revisión independiente (RDD) y la memoria.

## RDD: revisar el trabajo terminado a la profundidad justa

**RDD** (*Receipt-Driven Development*) es la revisión opcional de gentle-ai. Su idea es que una revisión no pueda desfasarse: **congela los bytes exactos** que se van a revisar, elige la profundidad según el riesgo del cambio y permite como mucho **una** corrección acotada.

La profundidad va de una lectura estructural (sin revisores) a las cuatro lentes «4R»: **Riesgo**, **Resiliencia**, **Legibilidad** y **Confiabilidad**. El resultado es informativo: hacer commit, publicar o liberar sigue siendo decisión de la persona. Viene activada y se apaga con `gentle-ai review mode disable`.

## Cómo se vio en Vaqcrow

Vaqcrow es una demo de financiamiento por *revenue share* para PyMEs argentinas sobre Stellar Testnet. Sus harneses principales fueron **Claude Code** y **OpenCode**, ambos configurados con gentle-ai. Algunos rastros concretos en el repositorio:

- **El cambio de paradigma está en la historia de Git.** El proyecto nace el 9 de septiembre de 2026 con SDD. El 15 de septiembre sus artefactos pasan de `openspec/` a Engram. Los primeros documentos `odd/tasks/` aparecen el 20 de septiembre, y hoy hay **112**.
- **El documento de la feature alimenta la evidencia.** Cada *Feature* cierra con un documento de evidencia en `docs/planning/`, escrito a partir de su bitácora en `odd/tasks/`: unidades de trabajo con su commit, ciclos RED→GREEN, decisiones y advertencias.
- **Las instrucciones del proyecto viven en el repositorio.** `AGENTS.md` y `CLAUDE.md` son gemelos idénticos que leen OpenCode y Claude Code. El registro de skills (`.atl/skill-registry.md`) dice qué skill cargar para cada tecnología: Supabase, HeroUI, Stellar o seguridad OWASP.
- **Tests primero, incluso para un artículo.** Esta misma nota se escribió con ODD. Primero se agregó el test que exige que el artículo pase el filtro de términos prohibidos de la copy pública, se lo vio fallar porque el archivo no existía, y recién después se escribió el texto.

La lección más útil fue la de ODD: **el humano dirige**. El agente explora, propone y ejecuta, pero las decisiones de producto se las pregunta a la persona, de a una. Y cuando una afirmación dice «esto está probado», se contrasta con el código y la evidencia antes de escribirla.

## Lo que conviene tener en cuenta

- **Es una herramienta joven y en movimiento.** Entre el inicio de Vaqcrow y este artículo, gentle-ai cambió su flujo principal. Fijá la versión que usás y leé las notas de cada *release*.
- **Las cifras son del propio proyecto** y, por lo que él mismo aclara, de una sola corrida.
- **No reemplaza el criterio.** ODD reduce la ceremonia, pero la calidad la siguen sosteniendo los tests, la revisión y una persona que sabe qué pedir y por qué.

## Para seguir aprendiendo

- [gentle-ai en GitHub](https://github.com/Gentleman-Programming/gentle-ai) y su [sitio](https://gentle-ai.gentlemanprogramming.com/).
- [Guía de uso, sección ODD](https://github.com/Gentleman-Programming/gentle-ai/blob/main/docs/usage.md) y [reglas de delegación](https://github.com/Gentleman-Programming/gentle-ai/blob/main/docs/trigger-rules.md).
- [Integración de la revisión (RDD)](https://github.com/Gentleman-Programming/gentle-ai/blob/main/docs/review-integration.md) y [agentes compatibles](https://github.com/Gentleman-Programming/gentle-ai/blob/main/docs/agents.md).
- Los *issues* del cambio: [#4612](https://github.com/Gentleman-Programming/gentle-ai/issues/4612) y [#4959](https://github.com/Gentleman-Programming/gentle-ai/issues/4959).
- [Engram](https://github.com/Gentleman-Programming/engram), [gentle-pi](https://github.com/Gentleman-Programming/gentle-pi), [GGA](https://github.com/Gentleman-Programming/gentleman-guardian-angel) y [Gentleman.Dots](https://github.com/Gentleman-Programming/Gentleman.Dots).
- [Gentleman Programming](https://gentlemanprogramming.com/), su [canal de YouTube](https://www.youtube.com/c/GentlemanProgramming) y su [comunidad en Discord](https://discord.com/invite/gentleman-programming-769863833996754944).
