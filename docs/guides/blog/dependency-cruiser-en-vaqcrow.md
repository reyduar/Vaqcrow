---
title: "dependency-cruiser: la arquitectura de Vaqcrow, revisada en cada cambio"
tags:
  - blog
  - arquitectura
  - dependency-cruiser
  - monorepo
  - calidad
---

# dependency-cruiser: la arquitectura de Vaqcrow, revisada en cada cambio

Toda arquitectura empieza como un dibujo: cajas, flechas y una regla del estilo «esta capa no conoce a aquella». El problema es que el dibujo no se defiende solo. Alcanza con un `import` apurado, metido un viernes para salir del paso, para que la regla deje de cumplirse sin que nadie se entere. Un mes después hay diez más y el dibujo ya no describe el código.

En Vaqcrow esa erosión la frena una herramienta: **dependency-cruiser**. Este artículo explica qué es, cómo funciona por dentro, qué tiene que ver (y qué no) con pnpm, y cómo lo usamos para que la arquitectura del monorepo sea algo que se verifica, no algo que se recuerda.

## Qué es dependency-cruiser

[dependency-cruiser](https://github.com/sverweij/dependency-cruiser) es una herramienta de código abierto, con licencia MIT, creada por Sander Verweij. Analiza proyectos de JavaScript y TypeScript, arma el **grafo de dependencias** —qué archivo importa a qué otro— y lo compara contra **reglas** que vos escribís. Si un import viola una regla, el comando termina con error.

También sabe dibujar ese grafo (en Graphviz, Mermaid o HTML), pero en Vaqcrow lo usamos para lo otro: como **guardia de fronteras**. Hoy usamos la versión 16.10.4.

Pensalo como el inspector de una obra. Los planos dicen que la cañería no atraviesa la viga; el inspector no diseña nada, pero recorre la obra y frena el avance si encuentra una cañería donde no va.

## ¿Es parte de pnpm?

**No.** Es una confusión común, porque en Vaqcrow se lo corre con `pnpm run boundaries`. Pero dependency-cruiser es un paquete npm más, que funciona igual con npm, Yarn o pnpm. Lo que hace pnpm es otra cosa:

| | pnpm | dependency-cruiser |
|---|---|---|
| **Qué es** | Gestor de paquetes y de *workspaces* | Analizador de dependencias entre archivos |
| **Qué cuida** | Que cada paquete use solo las dependencias que declaró en su `package.json` | Que cada archivo importe solo lo que la arquitectura permite |
| **Ejemplo de error** | `apps/web` usa una librería que nunca declaró | Un caso de uso de la API importa Fastify |
| **En Vaqcrow** | Instala, enlaza los paquetes del monorepo y ejecuta los scripts | Corre como el script `boundaries` |

Las dos cosas se complementan. pnpm, por cómo arma `node_modules`, ya impide usar una dependencia no declarada: es una frontera **entre paquetes**. Pero no sabe nada de capas. Si `apps/api` declara Fastify (y lo declara, porque lo necesita), pnpm no tiene forma de saber que la carpeta `application/` no debería tocarlo. Esa frontera, **dentro de un paquete**, es la que dibuja dependency-cruiser.

La única relación con pnpm es el script del `package.json` raíz:

```json
"boundaries": "depcruise apps/*/src packages/*/src --config .dependency-cruiser.cjs"
```

`depcruise` es el ejecutable de dependency-cruiser; pnpm solo lo lanza.

## Cómo funciona por dentro

Cada corrida hace cinco cosas:

1. **Lee las entradas.** Recorre los directorios que le pasás: en Vaqcrow, el código fuente de cada aplicación y de cada paquete (`apps/*/src` y `packages/*/src`).
2. **Encuentra cada import.** Lee los `import` y `require` de cada archivo. Con `tsPreCompilationDeps: true` los mira **antes** de compilar el TypeScript, así ve también los imports de solo tipos, que el compilador borra.
3. **Resuelve a dónde apunta cada uno.** Usa el `tsconfig.base.json` del repositorio y la misma lógica de resolución que Node, de modo que `"fastify"` se convierte en un archivo real dentro de `node_modules`.
4. **Clasifica cada dependencia.** La marca como local, paquete npm, módulo propio de Node (`core`, como `node:crypto`) o de solo tipos (`type-only`), entre otras categorías.
5. **Compara con las reglas.** Cada regla `forbidden` describe un `from` (desde qué archivos) y un `to` (hacia qué cosas). Si una dependencia encaja en ambos lados, es una violación.

En el repositorio de hoy, una corrida limpia se ve así:

```text
✔ no dependency violations found (1422 modules, 4750 dependencies cruised)
```

## La arquitectura que protege

Vaqcrow es un monorepo con dos aplicaciones y tres paquetes, y cada aplicación está organizada en capas:

![Diagrama: apps/web tiene las capas presentation, state, infrastructure y application; apps/api tiene infrastructure, con Fastify, Supabase, el SDK de Stellar y la IA, y application, con los casos de uso y los puertos. La web y la API no se importan entre sí. La web consume solo packages/contracts; la API usa contracts, domain y ai. Los imports prohibidos hacen fallar la verificación.](/blog-assets/fronteras-de-dependencias.svg)

- **`apps/api`** es la API, construida con Fastify. Su capa `application/` tiene los **casos de uso** (abrir una campaña, registrar una decisión humana, responder en el asistente) y los **puertos**, que son interfaces: «necesito guardar una solicitud», «necesito desplegar una bóveda». La capa `infrastructure/` tiene los **adaptadores** que implementan esos puertos con tecnología concreta: Supabase, el SDK de Stellar, el proveedor de IA y el propio Fastify.
- **`apps/web`** es la aplicación Next.js, con `presentation/` (componentes), `state/` (los *stores* de Zustand), `infrastructure/` (las llamadas HTTP, Supabase y Freighter) y `application/` (datos y selectores puros).
- **`packages/contracts`** son los tipos y esquemas que comparten la web y la API, así que tienen que poder correr en Node y en el navegador.
- **`packages/domain`** son las reglas del negocio, y no dependen de ninguna librería.
- **`packages/ai`** es el contrato de la evaluación con IA y sus guardas, y vive del lado de la API.

La idea central es la de la **arquitectura hexagonal**: el núcleo (casos de uso y dominio) no conoce la tecnología, y la tecnología se enchufa desde afuera. Si mañana cambiamos Supabase por otra base de datos, se reemplaza un adaptador y los casos de uso no se tocan.

## Las trece reglas

Todas viven en `.dependency-cruiser.cjs`, en la raíz, y todas tienen severidad `error`:

| Regla | Qué prohíbe | Por qué |
|---|---|---|
| `no-circular` | Cualquier import circular | Un ciclo vuelve imposible entender quién depende de quién |
| `packages-never-import-apps` | Que un paquete importe una aplicación | Los paquetes son la base; no pueden depender de lo que se construye encima |
| `no-cross-app-imports` | Que una aplicación importe otra | La web y la API se hablan por HTTP, no por código |
| `web-never-imports-domain` | Que la web importe `packages/domain` | Las reglas de negocio las decide el backend |
| `web-never-imports-ai` | Que la web importe `packages/ai` | La web nunca habla con el modelo |
| `web-never-imports-server-stellar-sdk` | Que la web use el SDK de Stellar en runtime | La web firma con Freighter; armar y verificar transacciones es de la API |
| `api-never-imports-wallet-sdk` | Que la API use el SDK de Freighter en runtime | La API no tiene wallet y no firma |
| `domain-stays-framework-free` | Que `domain` importe cualquier paquete npm | El dominio se mantiene puro y fácil de probar |
| `contracts-never-import-node-core` | Que `contracts` use módulos propios de Node | Tiene que correr también en el navegador |
| `contracts-never-import-frameworks` | Que `contracts` importe Fastify | La integración con el framework va en otra parte |
| `api-application-stays-provider-free` | Que los casos de uso importen Fastify, Supabase, Stellar o la IA en runtime | El núcleo no conoce la tecnología |
| `web-presentation-stays-contracts-free` | Que los componentes importen `contracts` en runtime | Los contratos cruzan en `infrastructure/` y `state/` |
| `web-application-stays-react-free` | Que `application/` de la web importe React | Ahí solo hay datos y selectores puros |

Dos de esas reglas protegen algo más que el orden: `web-never-imports-server-stellar-sdk` y `api-never-imports-wallet-sdk` son la versión en código del principio **no custodial** de Vaqcrow. La plataforma no firma por los usuarios, y la arquitectura hace que ni siquiera tenga a mano la herramienta para hacerlo.

## Anatomía de una regla

Esta es la regla que mantiene limpio el núcleo de la API:

```js
{
  name: "api-application-stays-provider-free",
  severity: "error",
  from: { path: "^apps/api/src/application/" },
  to: {
    path: "(^|/)node_modules/(fastify|@fastify|@supabase|@stellar|stellar-sdk|@anthropic-ai|openai)(/|$)",
    dependencyTypesNot: ["type-only"]
  }
}
```

Leída en castellano: «desde cualquier archivo de `apps/api/src/application/`, hacia cualquier archivo de esos paquetes, salvo que el import sea de solo tipos, es un error».

Un detalle que muestra dónde se cruzan pnpm y dependency-cruiser: pnpm no guarda los paquetes en `node_modules/fastify` directamente, sino en rutas como `node_modules/.pnpm/fastify@5.12.4/node_modules/fastify/`. Por eso la expresión regular no está anclada al principio con `^node_modules`: busca `node_modules/fastify` **en cualquier parte** de la ruta resuelta, y así encaja también con el formato de pnpm.

## La excepción de los tipos

Varias reglas llevan `dependencyTypesNot: ["type-only"]`. ¿Por qué permitir esos imports?

Porque un puerto a veces necesita **nombrar** un tipo de una librería, sin usarla. Comparalo:

```ts
import type { FastifyInstance } from "fastify"; // permitido: desaparece al compilar
import Fastify from "fastify";                  // prohibido: trae Fastify en runtime
```

El primero solo existe para el compilador de TypeScript y no queda nada de él en el JavaScript final. El segundo carga Fastify de verdad. La frontera que importa es la de lo que **se ejecuta**, y por eso la excepción está escrita explícitamente en cada regla, en vez de relajar la regla entera.

## Lo vimos fallar

Una regla que nunca falló no demuestra nada. Para este artículo creamos a propósito un archivo dentro de los casos de uso de la API:

```ts
// apps/api/src/application/zz-demo-violation.ts
import Fastify from "fastify";
export const app = Fastify;
```

Y dependency-cruiser respondió:

```text
  error api-application-stays-provider-free: apps/api/src/application/zz-demo-violation.ts → node_modules/.pnpm/fastify@5.12.4/node_modules/fastify/fastify.js

x 1 dependency violations (1 errors, 0 warnings). 1423 modules, 4751 dependencies cruised.
```

El mensaje dice qué regla se rompió, qué archivo la rompió y hacia dónde apuntaba el import. Después borramos el archivo, por supuesto.

## Quién revisa al revisor

Una regla mal escrita es peor que ninguna: da la sensación de estar protegido sin estarlo. Una expresión regular con un error de tipeo, por ejemplo, no atrapa nada y nunca falla.

Por eso las reglas tienen sus propios tests, en `tests/boundaries.test.ts`, que se corren con `pnpm run test:boundaries`. Usan **fixtures**: archivos de ejemplo en `tests/fixtures/boundaries/` que imitan la estructura del monorepo y que importan, a propósito, lo que no deberían. Los tests llaman a dependency-cruiser por su API de JavaScript (`cruise()`) y comprueban dos cosas:

- que cada fixture prohibido dispare **exactamente la regla con ese nombre**, no otra cualquiera;
- que los fixtures de solo tipos **no** disparen nada, para probar que la excepción funciona.

Hay además un test que vigila que los fixtures nunca entren en la corrida real: si la ruta de `pnpm run boundaries` llegara a incluirlos, la verificación del repositorio fallaría por archivos que existen justamente para fallar.

## Dónde corre

`pnpm run boundaries` y `pnpm run test:boundaries` son los dos últimos pasos de `pnpm run verify`, el comando que tiene que pasar antes de dar un cambio por terminado:

```text
lint → typecheck → test → build → boundaries → test:boundaries
```

Y `verify` es lo que corre la integración continua en GitHub Actions en cada pull request. Ningún cambio llega a la rama principal con un import prohibido sin que el pipeline lo marque en rojo.

Esto importa todavía más cuando gran parte del código lo escribe un agente de IA, como en Vaqcrow. Un agente no se acuerda del diagrama de la semana pasada; una regla que falla, sí la ve.

## Lo que no hace

Para usarlo bien, conviene saber dónde termina:

- **Analiza imports, no comportamiento.** Si un caso de uso recibe un cliente de Supabase por parámetro y lo usa, dependency-cruiser no lo ve: el import está en otro lado. La inyección de dependencias por puertos es justamente el diseño que buscamos, pero la regla solo cuida los imports.
- **No ve imports dinámicos armados en tiempo de ejecución**, como un `require(nombre)` con un nombre calculado.
- **Las reglas valen lo que valen sus rutas.** Si alguien crea una carpeta nueva con otro nombre, la regla no la cubre hasta que se la actualice. Por eso cada regla tiene un `comment` que explica su intención.
- **No reemplaza la revisión de código.** Atrapa la clase de error que se puede describir como «A no importa B». El resto sigue siendo trabajo de personas.

## En resumen

dependency-cruiser no es parte de pnpm: es una herramienta independiente que lee los imports, arma el grafo y lo compara con reglas. En Vaqcrow, trece reglas convierten el diagrama de la arquitectura —capas, paquetes y la separación entre web y API— en algo que se verifica en cada cambio, incluido el principio no custodial. Y las reglas, a su vez, tienen tests que prueban que atrapan lo que dicen atrapar.

La arquitectura deja de depender de la memoria de alguien. Queda escrita en el repositorio y se revisa sola.
