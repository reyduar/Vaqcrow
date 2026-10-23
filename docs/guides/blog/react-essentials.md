---
title: React Essentials
tags:
  - blog
  - react
  - frontend
  - typescript
  - arquitectura
---

# React Essentials

Una guía de React pensada como material de estudio y de consulta: los fundamentos, los hooks, el ecosistema de estado, el enrutamiento, los formularios, la arquitectura y lo que cambió con React 19. Cada afirmación técnica se contrastó contra la documentación oficial de React y de cada biblioteca, con las versiones indicadas explícitamente.

## Índice

- [Fundamentos](#fundamentos)
- [¿Por qué React?](#por-qué-react)
  - [La flexibilidad como ventaja y como riesgo](#la-flexibilidad-como-ventaja-y-como-riesgo)
  - [Cuándo no conviene usarlo](#cuándo-no-conviene-usarlo)
  - [El rol de un senior en un equipo que adopta React](#el-rol-de-un-senior-en-un-equipo-que-adopta-react)
- [Cómo detecta React los cambios](#cómo-detecta-react-los-cambios)
  - [Render y reconciliación](#render-y-reconciliación)
  - [El virtual DOM como modelo mental](#el-virtual-dom-como-modelo-mental)
  - [Por qué mutar el estado no dispara un render](#por-qué-mutar-el-estado-no-dispara-un-render)
  - [El rol de key](#el-rol-de-key)
  - [Qué es un re-render y qué no es](#qué-es-un-re-render-y-qué-no-es)
- [Batching de estados](#batching-de-estados)
  - [Qué agrupa y qué no](#qué-agrupa-y-qué-no)
- [ReactNode, ReactElement y JSX.Element](#reactnode-reactelement-y-jsxelement)
  - [La unión ReactNode](#la-unión-reactnode)
  - [ReactElement](#reactelement)
  - [Qué usar para children](#qué-usar-para-children)
  - [El namespace JSX](#el-namespace-jsx)
  - [Estado que puede ser nulo](#estado-que-puede-ser-nulo)
- [Modelado de datos con TypeScript](#modelado-de-datos-con-typescript)
  - [type o interface](#type-o-interface)
  - [Declaration merging](#declaration-merging)
  - [El costo de performance de extends](#el-costo-de-performance-de-extends)
  - [Modelado de una entidad](#modelado-de-una-entidad)
- [PropTypes y el fin de la validación en runtime](#proptypes-y-el-fin-de-la-validación-en-runtime)
  - [Qué cambió en React 19](#qué-cambió-en-react-19)
  - [La vía actual](#la-vía-actual)
- [Hooks](#hooks)
- [Las reglas de los hooks](#las-reglas-de-los-hooks)
- [useState](#usestate)
- [useEffect](#useeffect)
  - [Qué NO va en un useEffect](#qué-no-va-en-un-useeffect)
- [useContext](#usecontext)
- [useReducer](#usereducer)
- [useRef](#useref)
- [useMemo, useCallback y memo](#usememo-usecallback-y-memo)
- [React Compiler cambió la recomendación](#react-compiler-cambió-la-recomendación)
- [Custom hooks](#custom-hooks)
- [Manejo de estados](#manejo-de-estados)
- [Qué es el estado de una aplicación](#qué-es-el-estado-de-una-aplicación)
  - [Las cinco clases](#las-cinco-clases)
- [Context API](#context-api)
  - [Cuándo usarlo](#cuándo-usarlo)
  - [Cuándo no usarlo](#cuándo-no-usarlo)
- [Context API con useReducer](#context-api-con-usereducer)
- [Redux](#redux)
- [Redux Toolkit](#redux-toolkit)
  - [Lógica asíncrona con createAsyncThunk](#lógica-asíncrona-con-createasyncthunk)
- [RTK Query](#rtk-query)
- [TanStack Query](#tanstack-query)
- [SWR](#swr)
  - [isLoading e isValidating](#isloading-e-isvalidating)
- [Zustand](#zustand)
  - [Una store por montaje](#una-store-por-montaje)
- [Jotai](#jotai)
  - [Jotai frente a Zustand](#jotai-frente-a-zustand)
- [Qué herramienta elegir](#qué-herramienta-elegir)
- [Compartir información entre componentes](#compartir-información-entre-componentes)
  - [De padre a hijo](#de-padre-a-hijo)
  - [Entre hermanos](#entre-hermanos)
  - [Por qué composición antes que Context para layout](#por-qué-composición-antes-que-context-para-layout)
- [Enrutamiento](#enrutamiento)
- [Enrutamiento del lado del cliente](#enrutamiento-del-lado-del-cliente)
- [React Router](#react-router)
- [Rutas declarativas](#rutas-declarativas)
- [Navegación con Link y NavLink](#navegación-con-link-y-navlink)
- [Layouts anidados con Outlet](#layouts-anidados-con-outlet)
- [useNavigate, useParams y useSearchParams](#usenavigate-useparams-y-usesearchparams)
- [Data router](#data-router)
- [Rutas protegidas](#rutas-protegidas)
- [Un ejemplo completo](#un-ejemplo-completo)
- [Datos, formularios y estilos](#datos-formularios-y-estilos)
- [Axios](#axios)
- [Interceptores](#interceptores)
- [Cancelación de peticiones](#cancelación-de-peticiones)
- [Manejo de errores](#manejo-de-errores)
- [Organizar las llamadas en capas](#organizar-las-llamadas-en-capas)
- [React Hook Form](#react-hook-form)
- [Validación con esquemas](#validación-con-esquemas)
- [Estilos](#estilos)
  - [CSS Modules y SCSS](#css-modules-y-scss)
  - [Variables CSS](#variables-css)
  - [style en línea](#style-en-línea)
- [Arquitectura y React 19](#arquitectura-y-react-19)
- [Arquitectura para diseñar aplicaciones React](#arquitectura-para-diseñar-aplicaciones-react)
- [Screaming Architecture](#screaming-architecture)
- [Clean Architecture](#clean-architecture)
- [Container y presentational](#container-y-presentational)
- [Portals](#portals)
- [Higher order components](#higher-order-components)
- [Suspense y lazy](#suspense-y-lazy)
- [ErrorBoundary](#errorboundary)
- [React 19 no es experimental](#react-19-no-es-experimental)
- [Actualizar a React 19](#actualizar-a-react-19)
- [Componentes de servidor y Actions](#componentes-de-servidor-y-actions)
- [Actions y formularios](#actions-y-formularios)
- [useOptimistic](#useoptimistic)
- [use](#use)
- [ref como prop y Context como provider](#ref-como-prop-y-context-como-provider)
- [Metadatos, estilos y precarga](#metadatos-estilos-y-precarga)
- [Lo que React 19 eliminó](#lo-que-react-19-eliminó)
- [Novedades de React 19.3](#novedades-de-react-193)
- [React Compiler en una frase](#react-compiler-en-una-frase)

## Fundamentos

## ¿Por qué React?

React es una biblioteca para construir interfaces de usuario. No es un framework, y la diferencia importa: no trae router, ni capa de datos, ni convención de carpetas, ni sistema de estilos, ni una forma obligatoria de organizar el estado. Trae una idea central y la sostiene con una API pequeña: la interfaz es una función del estado, y React se encarga de mantener el DOM alineado con esa función.

El problema que resuelve es concreto. Cuando una pantalla tiene muchas piezas interdependientes —un formulario, una lista, un total que depende de ambos—, el código imperativo tiende a dispersarse: cada acción toca el DOM en varios lugares y la consistencia entre esos lugares queda a cargo de quien escribe. React reemplaza esa coordinación manual por una descripción declarativa. Se dice cómo debería verse la interfaz para un estado dado y la biblioteca calcula qué cambió. React se mantiene estable desde el 5 de diciembre de 2024 y su versión actual es la 19.3.1. No existe React 20: las líneas de versión avanzan dentro de la 19, y conviene decirlo porque circula la idea contraria.

### La flexibilidad como ventaja y como riesgo

Elegir cada pieza por separado permite ajustar el stack al problema: un router simple para un panel interno, uno con carga diferida por ruta para un sitio público, una librería de estado mínima para un formulario y una más estructurada para un flujo con muchas transiciones. La misma ausencia de opinión produce el riesgo inverso: decisiones repetidas en cada proyecto —cómo se nombran los archivos, dónde viven los efectos, cuándo un hook es reutilizable— y, sin alguien que fije las reglas, tres maneras de pedir datos conviviendo en el mismo repositorio.

| Decisión | Ventaja real | Costo que asume el equipo |
| --- | --- | --- |
| Router | Se elige según el modelo de navegación | Hay que definir convenciones de rutas y de carga |
| Estado | Se ajusta a la forma de los datos | Cada equipo puede resolver lo mismo de otra manera |
| Estilos | Libertad total de enfoque | Se pierde consistencia visual si nadie la sostiene |
| Datos remotos | Se integra la caché que convenga | Hay que decidir dónde vive la verdad y cómo se invalida |

### Cuándo no conviene usarlo

- Cuando la página es principalmente contenido y la interacción es mínima: HTML servido desde el servidor resuelve el problema con menos piezas móviles.
- Cuando el equipo no tiene disciplina de tipos ni revisión de código: la flexibilidad se convierte en deuda rápidamente.
- Cuando la complejidad del producto está en el backend y la interfaz es un formulario y una tabla: el costo de introducir un ecosistema supera el beneficio.
- Cuando se busca una respuesta oficial para todo: un framework con decisiones incluidas encaja mejor con esa expectativa.

### El rol de un senior en un equipo que adopta React

El senior no aporta "saber React"; aporta criterio sobre lo que React deja abierto. Define el conjunto mínimo de dependencias, escribe las convenciones que el equipo va a seguir y las defiende en revisión, decide qué abstracciones existen y cuáles se evitan hasta que haya una tercera repetición del mismo patrón, y sostiene el modelo mental: estado como fuente de verdad, derivados calculados en render, efectos solo para sincronizar con el exterior. También es quien dice que no a una librería nueva cuando la existente alcanza.

## Cómo detecta React los cambios

Entender el ciclo evita dos errores frecuentes: optimizar donde no hay costo y esperar que React "vea" cambios que nunca se le notificaron. La secuencia es siempre la misma: se dispara un render, se produce un árbol de elementos y la reconciliación decide qué tocar del DOM.

### Render y reconciliación

Render es la ejecución de los componentes para producir una descripción de la interfaz. Esa descripción es un árbol de objetos livianos, no nodos del DOM. Reconciliación es la comparación entre el árbol nuevo y el anterior, y su salida es una lista de operaciones concretas: crear un nodo, actualizar un atributo, mover un hijo, eliminar otro. Un componente se vuelve a ejecutar por dos motivos: cambió su propio estado, o se volvió a ejecutar su padre. No hay una lista de dependencias que decida si "hace falta" renderizar: se ejecuta y la reconciliación descarta lo que no cambió.

### El virtual DOM como modelo mental

El "virtual DOM" describe bien la idea y mal la optimización. No es una capa que hace que todo sea rápido: producir un árbol de objetos y compararlo tiene costo. Lo que aporta es otra cosa: permite escribir la interfaz como una función del estado sin calcular a mano qué nodo cambió, y concentra la comparación en un algoritmo probado en lugar de repartirla entre decenas de actualizaciones manuales. Cuando una pantalla es lenta, la causa suele estar en el trabajo que ocurre durante el render o en un exceso de renders, no en la existencia del árbol intermedio.

### Por qué mutar el estado no dispara un render

React no observa objetos. No hay proxies ni copias internas que detecten una escritura. Lo único que dispara un render es la llamada a un setter de estado, y la comparación para decidir si hubo cambio es de referencia. Si se muta el objeto y se pasa el mismo al setter, la referencia no cambió y el render no ocurre. Peor aún: si ocurre por otro motivo, la comparación superficial puede concluir que nada cambió y saltear la actualización.

**`mutacion-vs-copia.tsx`**

```tsx
import { useState } from "react";

type Note = { id: string; text: string };

export function NoteList() {
  const [items, setItems] = useState<Note[]>([]);
  function removeNoteBroken(id: string) {
    const index = items.findIndex((note) => note.id === id);
    items.splice(index, 1); // Muta el array existente.
    setItems(items); // Misma referencia: no hay render.
  }

  function removeNote(id: string) {
    // Filtro: nueva referencia con el elemento fuera.
    setItems((previous) => previous.filter((note) => note.id !== id));
  }

  return (
    <ul>
      {items.map((note) => (
        <li key={note.id} onClick={() => removeNote(note.id)}>
          {note.text}
        </li>
      ))}
    </ul>
  );
}
```

La regla práctica es tratar el estado como inmutable: se produce un valor nuevo en lugar de modificar el existente. El setter funcional, que recibe el valor previo, evita además leer un estado que puede estar desactualizado dentro del mismo ciclo.

### El rol de key

`key` no es un accesorio para silenciar la advertencia de listas. Es la identidad que React usa para decidir qué elemento del árbol nuevo corresponde a cuál del anterior. Con una identidad estable, reordenar una lista mueve nodos y conserva el estado local de cada fila. Sin identidad estable, React reutiliza posiciones y el estado se queda con el elemento equivocado.

**`lista-con-indice.tsx`**

```tsx
// Frágil: la identidad es la posición, no el dato.
{rows.map((row, index) => <RowItem key={index} row={row} />)}

// Estable: la identidad viaja con el dato.
{rows.map((row) => <RowItem key={row.id} row={row} />)}
```

Con índices, insertar un elemento al principio desplaza a todos los demás: la fila que estaba en la posición 0 ahora muestra otro dato, pero conserva el foco, el texto escrito a medio tipear o el estado de expansión que pertenecía al anterior. El índice solo es aceptable en listas que no se reordenan, no se filtran y no crecen por delante.

### Qué es un re-render y qué no es

Un re-render es volver a ejecutar el componente y producir un árbol nuevo. No es una escritura al DOM. Si el resultado es equivalente al anterior, la reconciliación no emite ninguna mutación y el DOM queda igual. De ahí que "se renderizó tres veces" no signifique "el navegador pintó tres veces": el costo está en el trabajo de render, y solo se convierte en costo de pintura cuando hay cambios reales que aplicar.

## Batching de estados

Batching es agrupar varias actualizaciones de estado en un solo render. Importa porque cada render tiene costo y porque varios renders intermedios pueden mostrar estados que nunca deberían verse juntos: un contador actualizado y una etiqueta todavía vieja. Desde React 18 es automático: no hace falta envolver nada en `unstable_batchedUpdates` ni declarar el origen del evento, porque React agrupa las actualizaciones que ocurren dentro de una `Promise`, dentro de un `setTimeout`, dentro de un handler nativo registrado a mano y dentro de "cualquier otro evento". La frase entre comillas es la del equipo de React y describe el criterio: el origen deja de importar.

### Qué agrupa y qué no

| Origen de las actualizaciones | ¿Se agrupan? |
| --- | --- |
| Handler de un evento de React | Sí |
| Dentro de una `Promise`, después de `await` | Sí |
| Dentro de `setTimeout` o `setInterval` | Sí |
| Handler nativo con `addEventListener` | Sí |
| Dos clics distintos e intencionales | No, y es correcto |

La última fila no es una limitación. Dos clics son dos eventos separados en el tiempo, con dos intenciones separadas; agruparlos produciría una interfaz que responde dos veces a una sola acción visible. El batching agrupa lo que ocurre dentro de una misma tarea, no lo que el usuario decidió hacer en dos momentos.

**`batching.tsx`**

```tsx
import { useState } from "react";

export function BatchingDemo() {
  const [count, setCount] = useState(0);
  const [label, setLabel] = useState("inicial");
  // Una línea por pasada de render.
  console.log("render", count, label);
  function handleTimeout() {
    setTimeout(() => {
      setCount((value) => value + 1);
      setLabel("setTimeout");
    }, 0);
  }

  async function handlePromise() {
    await Promise.resolve();
    setCount((value) => value + 1);
    setLabel("Promise");
  }

  return (
    <div>
      <p>{count} — {label}</p>
      <button onClick={handleTimeout}>setTimeout</button>
      <button onClick={handlePromise}>Promise</button>
    </div>
  );
}
```

Los dos botones producen una sola pasada de render por clic aunque cada uno llame a dos setters. Antes de React 18 esos mismos casos generaban dos pasadas, porque el batching solo cubría los eventos sintéticos. En desarrollo, StrictMode ejecuta el render dos veces por pasada: la señal útil es cuántas pasadas hay, no el número absoluto de líneas impresas.

Hay una consecuencia práctica: no se puede leer el estado recién escrito en la línea siguiente y esperar el valor nuevo. El setter encola la actualización; el valor actualizado existe en el próximo render. Cuando el cálculo depende del valor previo, la forma segura es el setter funcional.

## ReactNode, ReactElement y JSX.Element

Estos tres nombres aparecen juntos en los tipos de casi cualquier componente y no significan lo mismo. Confundirlos produce errores de compilación que parecen arbitrarios, del tipo "un string no es asignable a este tipo" cuando el componente claramente devuelve un string.

### La unión ReactNode

`ReactNode` es la unión de todo lo que React sabe renderizar: un elemento, un string, un número, un `bigint`, un iterable de nodos, un portal, un booleano, `null` y `undefined`. En React 19 los tipos agregan `Promise`, porque un componente puede recibir una `Promise` resuelta por el árbol.

**`react-node.ts`**

```ts
type ReactNode =
  | ReactElement
  | string
  | number
  | bigint
  | Iterable<ReactNode>
  | ReactPortal
  | boolean
  | null
  | undefined;
```

Los booleanos, `null` y `undefined` forman parte de la unión porque el render condicional los produce todo el tiempo: `{condition && <Badge />}` devuelve `false` cuando la condición no se cumple, y React lo trata como "nada que dibujar".

### ReactElement

Un `ReactElement` es un objeto que describe qué renderizar: el tipo (un componente o una etiqueta), las props y la `key`. Es lo que produce JSX al compilarse, y crearlo no monta nada ni ejecuta el componente; solo construye la descripción, que se materializa durante el render del árbol que lo contiene. La distinción se nota cuando se guarda un elemento en estado o se pasa como prop: se está transportando una descripción, no un fragmento de DOM.

### Qué usar para children

Para `children` la recomendación oficial es `React.ReactNode`. Es la única de las tres que acepta texto, números, listas y condicionales, que es exactamente lo que un contenedor recibe en la práctica.

**`layout.tsx`**

```tsx
import type * as React from "react";

type LayoutProps = {
  title: string;
  children: React.ReactNode;
};
export function Layout({ title, children }: LayoutProps): React.JSX.Element {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
```

### El namespace JSX

Hasta React 18, el tipo que devuelve un componente se escribía `JSX.Element`, apoyado en un namespace global declarado por los tipos. En React 19 ese namespace global se eliminó: hoy se escribe `React.JSX.Element`, o se importa el tipo. El cambio rompe compilaciones que no lo esperaban, y la corrección es mecánica: el `Layout` de arriba ya lo muestra en su firma. Para props y `children` no hay que migrar nada: `React.ReactNode` sigue siendo el tipo correcto porque nunca dependió del namespace global.

### Estado que puede ser nulo

Cuando el estado puede no tener contenido, `ReactNode` es el tipo adecuado porque incluye `null`, y el valor inicial se escribe explícito para que la unión no se infiera de forma más amplia de lo necesario.

**`tooltip.tsx`**

```tsx
import { useState, type ReactNode } from "react";

export function Tooltip() {
  const [content, setContent] = useState<ReactNode>(null);
  return (
    <div>
      <button onClick={() => setContent(<p>Texto de ayuda</p>)}>Mostrar</button>
      <button onClick={() => setContent(null)}>Ocultar</button>
      {content}
    </div>
  );
}
```

Sin el genérico, TypeScript infiere `null` como único valor posible y el primer `setContent` no compila. El genérico declara la intención: este estado guarda algo renderizable, y ahora mismo no guarda nada.

## Modelado de datos con TypeScript

Los tipos no son documentación decorativa: son la herramienta que reemplaza buena parte de la validación que antes se hacía en tiempo de ejecución. Modelar bien una entidad evita que los errores aparezcan en la pantalla del usuario.

### type o interface

El heurístico del handbook de TypeScript es literal: "use interface until you need to use features from type". La razón es que `interface` tiene un mensaje de error más legible, se puede extender de forma declarativa y admite merging. `type` cubre lo que `interface` no puede expresar: uniones, tuplas, tipos mapeados y condicionales.

### Declaration merging

Dos declaraciones `interface` con el mismo nombre en el mismo ámbito se fusionan. Es la única de las dos que lo hace, y es la razón por la que las librerías declaran sus tipos como interfaces: permite que un proyecto agregue campos sin parchear el paquete.

**`env.d.ts`**

```ts
export {};
declare global {
  interface Window {
    analytics?: { track(event: string): void };
  }
}
```

Con `type` esto no es posible: una segunda declaración con el mismo nombre produce un error de identificador duplicado.

### El costo de performance de extends

Las interfaces se cachean: cuando el compilador comprueba si un tipo satisface a una interfaz, guarda el resultado y lo reutiliza en las comprobaciones siguientes. Los alias con intersecciones no tienen esa caché y se recalculan cada vez que se comparan. En un modelo pequeño la diferencia es irrelevante; en un grafo profundo, con muchas intersecciones anidadas, se nota en el tiempo de compilación y en la memoria del servidor de lenguaje. La conclusión no es prohibir `type`: es preferir `interface` para las formas que se comparan mucho y reservar `type` para lo que solo él expresa.

### Modelado de una entidad

Una factura mezcla una forma estable, una unión de estados y un conjunto de acciones. Cada pieza pide una herramienta distinta.

**`invoice.ts`**

```ts
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Invoice {
  id: string;
  customerId: string;
  status: InvoiceStatus;
  issuedAt: Date;
  lines: InvoiceLine[];
}
export type InvoiceAction =
  | { type: "mark-paid"; paidAt: Date }
  | { type: "void"; reason: string };
```

La interfaz describe la forma de la entidad. La unión de literales hace imposible un estado inventado. La unión discriminada de acciones obliga a que cada variante traiga sus datos: no se puede marcar como pagada sin fecha, ni anular sin motivo. Los importes se guardan en centavos enteros para no arrastrar errores de punto flotante.

## PropTypes y el fin de la validación en runtime

`prop-types` nació dentro de React y se extrajo a un paquete aparte en la versión 15.5. Durante años fue el mecanismo para avisar, en desarrollo, que un componente recibía una prop del tipo equivocado o que faltaba una requerida. El paquete sigue publicado en npm, en la versión 15.8.1, sin cambios desde 2022, pero React ya no lo consulta.

### Qué cambió en React 19

React 19 eliminó las validaciones de `propTypes`: las declaraciones se ignoran en silencio. También eliminó `defaultProps` en componentes de función, aunque lo mantiene en componentes de clase. El silencio es la parte importante: no hay advertencia, no hay error, no hay una nota de deprecación en la consola. Un componente con `propTypes` incompletos sigue funcionando igual que antes hasta que un dato llega mal y el fallo aparece lejos, en el momento de renderizar.

> [!warning] Corrección necesaria
> Si el proyecto todavía declara `propTypes` o `defaultProps` en componentes de función, esas declaraciones ya no hacen nada. No hay que actualizarlas: hay que reemplazarlas. La validación de tipos pasa a TypeScript, y los valores por defecto pasan a los parámetros de la función. Un `propTypes` que se dejó puesto da una falsa sensación de control: parece una red y ya no lo es.

### La vía actual

Los tipos se declaran en la firma y los valores por defecto se resuelven en la desestructuración. TypeScript comprueba en tiempo de compilación, el editor muestra el error antes de ejecutar y el valor por defecto queda en el mismo lugar donde se lee la prop. El equivalente anterior, `Badge.defaultProps = { tone: "neutral" }`, se ignora en componentes de función desde React 19.

**`badge.tsx`**

```tsx
type BadgeProps = {
  label: string;
  tone?: "neutral" | "success" | "danger";
};
export function Badge({ label, tone = "neutral" }: BadgeProps) {
  return <span data-tone={tone}>{label}</span>;
}
```

Queda un límite que conviene nombrar: TypeScript valida lo que el código cree sobre los datos, no lo que llega por la red. Si la aplicación recibe JSON de una API, el tipo declarado es una expectativa del programador y no una verificación del contenido. Esa comprobación, si hace falta, corresponde al límite del sistema, donde el dato entra; React dejó de ofrecerla y no la va a recuperar.
## Hooks

## Las reglas de los hooks

React 19.3.1 es la versión actual; React 19 es estable desde el 5 de diciembre de 2024. En esa versión, los hooks siguen dependiendo de una condición básica: deben ejecutarse en el mismo orden en cada render. React no identifica un hook por el nombre de la variable que devuelve; asocia cada llamada a una posición estable dentro del componente. Si una llamada aparece solo algunas veces, las posiciones se desplazan y el estado deja de corresponder a la llamada correcta.

Por eso existen dos reglas que no admiten excepciones prácticas:

- Los hooks se llaman solo en el nivel superior. No van dentro de condicionales, bucles, funciones anidadas ni callbacks.
- Los hooks se llaman solo desde componentes de función o desde hooks propios. Una función auxiliar común no puede invocarlos, aunque se ejecute durante el render.

La primera regla no prohíbe renderizar de forma condicional. Prohíbe condicionar la llamada al hook. Se puede decidir qué mostrar después de llamar a todos los hooks, pero no saltarse una llamada según una prop o una variable.

El siguiente ejemplo mantiene el orden: los dos hooks se ejecutan siempre y la condición solo controla el resultado visible.

**`panel.tsx`**
```tsx
import { useState } from "react";

export function Panel({ visible }: { visible: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [titulo] = useState("Detalle");

  if (!visible) {
    return null;
  }

  return (
    <button onClick={() => setAbierto(!abierto)}>
      {abierto ? titulo : "Abrir"}
    </button>
  );
}
```

El error típico es mover `useState` dentro de un `if`. Cuando la condición cambia, React encuentra una cantidad distinta de hooks y la posición de los siguientes ya no coincide. El resultado puede ser un estado cruzado o un fallo en tiempo de ejecución, no una simple advertencia visual.

> [!note]
> La regla no es una convención de estilo. Es el mecanismo que permite que React recuerde el estado entre renders sin recibir una clave por cada hook.

## useState

`useState` declara un valor que React conserva entre renders. Devuelve el valor actual y una función para actualizarlo. El argumento puede ser un valor o una función inicializadora. La función se ejecuta solo en el montaje; si se pasa el resultado de una llamada, esa expresión se evalúa en cada render aunque React ignore el valor después del primero.

La actualización puede recibir un valor nuevo o una función que recibe el valor anterior y devuelve el siguiente. Las actualizaciones se encolan y se aplican en orden. Cuando el siguiente valor depende del anterior, la forma funcional evita leer una copia vieja del estado.

React compara el valor nuevo con el anterior mediante `Object.is`. Si ambos son iguales, evita el re-render. Esa comparación es superficial: un objeto o un array nuevo siempre es distinto, aunque su contenido sea equivalente. Por eso no conviene mutar el objeto o el array existente. La mutación cambia el contenido sin cambiar la referencia y React puede no detectar el cambio; además, rompe la suposición de que el estado es inmutable.

El ejemplo usa un inicializador perezoso y una actualización funcional. También construye un array nuevo en lugar de modificar el anterior.

**`etiquetas.tsx`**
```tsx
import { useState } from "react";

function crearEtiquetas(): string[] {
  return ["mayorista", "minorista"];
}

export function Etiquetas() {
  const [etiquetas, setEtiquetas] = useState<string[]>(crearEtiquetas);

  function agregar() {
    setEtiquetas((actuales) => [
      ...actuales,
      `etiqueta-${actuales.length + 1}`,
    ]);
  }

  return (
    <div>
      <button onClick={agregar}>Agregar etiqueta</button>
      <ul>
        {etiquetas.map((etiqueta) => (
          <li key={etiqueta}>{etiqueta}</li>
        ))}
      </ul>
    </div>
  );
}
```

Pasar `crearEtiquetas` sin paréntesis entrega la función como inicializador. Pasar `crearEtiquetas()` ejecutaría la función en cada render. La diferencia importa cuando el cálculo es costoso o cuando no debe repetirse.

El error típico es actualizar con el valor capturado por el render: `setEtiquetas([...etiquetas, nueva])`. Si se hacen varias actualizaciones en el mismo evento o en una secuencia rápida, varias pueden partir del mismo array anterior. La forma funcional recibe siempre el valor más reciente de la cola. Otro error frecuente es usar `push` sobre el array del estado; el array cambia, pero su referencia no.

## useEffect

`useEffect` sirve para sincronizar un componente con un sistema externo. Ese sistema puede ser una API del navegador, una suscripción, un socket, un temporizador o un widget que vive fuera de React. No es la herramienta para calcular un valor a partir de props o de estado, ni para ejecutar lógica que pertenece a un manejador de eventos.

La guía oficial de React lo resume con una frase que conviene conservar:

> [!note]
> «If you're not trying to synchronize with some external system, you probably don't need an Effect.»

En español: si no se está intentando sincronizar con algún sistema externo, probablemente no se necesite un Effect. Esa es la pregunta previa a escribirlo, no una justificación posterior.

El Effect se ejecuta después del commit. Su función de limpieza se ejecuta antes del siguiente setup y también al desmontar el componente. Las dependencias se comparan con `Object.is`. Sin array de dependencias, el Effect se ejecuta en cada commit. El cleanup debe cancelar o deshacer exactamente lo que hizo el setup; si se registra un listener, se quita; si se abre una conexión, se cierra.

El ejemplo sincroniza el estado visual con los eventos de conexión del navegador. El listener es el sistema externo y el cleanup evita acumular registros.

**`indicador-conexion.tsx`**
```tsx
import { useEffect, useState } from "react";

export function IndicadorConexion() {
  const [enLinea, setEnLinea] = useState(false);

  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine);

    actualizar();
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);

    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);

  return <p>{enLinea ? "En línea" : "Sin conexión"}</p>;
}
```

El error típico es registrar una suscripción sin cleanup. Al cambiar una dependencia o al desmontar, el listener anterior sigue activo y el componente puede actualizar estado que ya no corresponde. Otro error es declarar dependencias que no se usan o leer valores externos sin incluirlos; el Effect queda con una copia vieja.

### Qué NO va en un useEffect

- Estado derivado. Si un valor se puede calcular a partir de props o de estado durante el render, se calcula ahí. Un Effect que llama al setter agrega un render extra y puede entrar en un ciclo.
- Transformaciones de datos. Filtrar, ordenar o agrupar es una operación de render. Si el costo es alto, se mide y se optimiza con `useMemo`; no se traslada a un Effect.
- Fetch con una librería de queries. Esa librería ya gestiona caché, cancelación y estados de carga. Un `useEffect` con `fetch` y varios `useState` duplica esa lógica y suele perder carreras.
- Sincronización entre estados. Mantener dos estados espejo obliga a decidir cuál es la fuente de verdad. Es preferible derivar uno del otro o guardar solo el dato mínimo.

La regla práctica es simple: si el código describe una transformación de la interfaz, va en el render; si describe una conexión con algo que existe fuera de React, va en un Effect.

## useContext

`useContext` lee el valor del provider más cercano que envuelve al componente. No lee el contexto global ni el primer provider del árbol: lee el más próximo en la jerarquía. Si no hay provider, recibe el valor por defecto pasado a `createContext`.

El consumidor se vuelve a renderizar cuando cambia el valor del provider, comparado con `Object.is`. `memo` no bloquea esa actualización. Un componente memorizado puede saltarse renders causados por props, pero sigue suscrito al contexto y se actualiza cuando el valor cambia. Por eso envolver un consumidor en `memo` no evita los renders de contexto.

El provider y el consumidor deben referenciar el mismo objeto de contexto. Crear dos contextos con el mismo nombre o importar una instancia distinta produce un consumidor que nunca encuentra al provider y recibe el valor por defecto.

En React 19 se puede usar el contexto directamente como provider: `<TemaContext value={...}>`. La forma anterior, `<TemaContext.Provider value={...}>`, sigue funcionando como API legacy. Ambas apuntan al mismo objeto de contexto.

**`tema-context.tsx`**
```tsx
import { createContext, useContext, useState } from "react";

type Tema = "claro" | "oscuro";

const TemaContext = createContext<Tema>("claro");

function EtiquetaTema() {
  const tema = useContext(TemaContext);
  return <p>Tema actual: {tema}</p>;
}

export function App() {
  const [tema, setTema] = useState<Tema>("claro");

  return (
    <TemaContext value={tema}>
      <EtiquetaTema />
      <button
        onClick={() => setTema(tema === "claro" ? "oscuro" : "claro")}
      >
        Cambiar tema
      </button>
    </TemaContext>
  );
}
```

El error típico es pasar un objeto nuevo en cada render, por ejemplo `value={{ tema }}`, y esperar que los consumidores no se actualicen. El objeto cambia de identidad en cada render y todos los consumidores se vuelven a renderizar. Otro error es confiar en `memo` para contener una actualización de contexto; no lo hace.

## useReducer

`useReducer` concentra las transiciones de estado en una función reductora. El reducer recibe el estado actual y una acción, y devuelve el estado siguiente. Debe ser puro: con las mismas entradas produce la misma salida, no muta el estado recibido y no ejecuta efectos secundarios. Toda la lógica de una transición queda en un lugar que se puede probar sin renderizar componentes.

La firma acepta un tercer argumento `init` para el estado inicial perezoso. El segundo argumento es el valor inicial que se pasa a `init`; si `init` no se usa, ese segundo argumento es el estado inicial. `dispatch` tiene identidad estable entre renders, así que se puede pasar a componentes memorizados sin recrearlo.

Conviene usar `useReducer` sobre `useState` cuando hay varias acciones que modifican una estructura, cuando el siguiente estado depende de una lógica ramificada o cuando muchos campos cambian juntos. Si el estado es un valor simple y las actualizaciones son directas, `useState` suele ser más claro.

**`lista-tareas.tsx`**
```tsx
import { useReducer } from "react";

type Tarea = {
  id: number;
  titulo: string;
  hecha: boolean;
};

type Accion =
  | { type: "agregar"; titulo: string }
  | { type: "alternar"; id: number };

function tareasReducer(tareas: Tarea[], accion: Accion): Tarea[] {
  switch (accion.type) {
    case "agregar":
      return [
        ...tareas,
        { id: tareas.length + 1, titulo: accion.titulo, hecha: false },
      ];
    case "alternar":
      return tareas.map((tarea) =>
        tarea.id === accion.id ? { ...tarea, hecha: !tarea.hecha } : tarea
      );
    default:
      return tareas;
  }
}

function iniciarTareas(_: null): Tarea[] {
  return [{ id: 1, titulo: "Revisar solicitud", hecha: false }];
}

export function ListaTareas() {
  const [tareas, dispatch] = useReducer(tareasReducer, null, iniciarTareas);

  return (
    <div>
      <button
        onClick={() => dispatch({ type: "agregar", titulo: "Nueva tarea" })}
      >
        Agregar
      </button>
      <ul>
        {tareas.map((tarea) => (
          <li key={tarea.id}>
            <button
              onClick={() => dispatch({ type: "alternar", id: tarea.id })}
            >
              {tarea.hecha ? "Hecha" : "Pendiente"}: {tarea.titulo}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

El error típico es mutar el estado dentro del reducer, por ejemplo con `tareas.push(...)` o cambiando `tarea.hecha` directamente. React compara referencias y el reducer deja de ser predecible. Otro error es ejecutar una petición o un `console.log` dentro del reducer: eso lo convierte en una función con efectos y rompe su pureza.

## useRef

`useRef` devuelve un objeto con una propiedad `current`. Cambiar `.current` no provoca un re-render. Esa es la diferencia central con `useState`: el ref sirve para guardar un valor que debe persistir entre renders sin participar en la salida visual.

No se debe leer ni escribir `.current` durante el render, con una excepción: la inicialización única, cuando el valor todavía no existe. Fuera de ese caso, leerlo durante el render hace que la interfaz dependa de un valor mutable que React no rastrea. La lectura y la escritura pertenecen a eventos o a Effects.

Un ref de DOM se asigna al nodo cuando React lo monta y se vuelve a `null` cuando lo desmonta. Por eso hay que comprobar que `.current` exista antes de usarlo. En React 19, `ref` es una prop normal de los componentes de función: `forwardRef` ya no es necesario y está anunciado para deprecación. Todavía funciona y no fue removido, pero el código nuevo no necesita envolver el componente para recibir una ref.

**`buscador.tsx`**
```tsx
import { useRef } from "react";

export function Buscador() {
  const inputRef = useRef<HTMLInputElement>(null);

  function enfocar() {
    inputRef.current?.focus();
  }

  return (
    <div>
      <input ref={inputRef} type="search" placeholder="Buscar" />
      <button onClick={enfocar}>Enfocar</button>
    </div>
  );
}
```

El error típico es esperar que cambiar `.current` actualice la pantalla. Si el valor debe verse en la interfaz, es estado y corresponde a `useState`. Otro error es leer `inputRef.current` en el cuerpo del render para decidir qué mostrar; en el primer render todavía es `null` y en los siguientes el valor puede cambiar sin que React vuelva a renderizar.

## useMemo, useCallback y memo

Los tres mecanismos reducen trabajo, pero cachean cosas distintas:

- `useMemo` cachea un valor calculado. Recalcula cuando cambian las dependencias, comparadas con `Object.is`.
- `useCallback` cachea la identidad de una función. Es equivalente a `useMemo(() => fn, deps)`.
- `memo` envuelve un componente y evita su render cuando las props son shallow-equal, comparadas con `Object.is`.

Son optimizaciones de rendimiento, no reglas semánticas. La corrección del componente no debe depender de que la caché se conserve. `memo` no evita renders causados por el estado propio del componente ni por un cambio de contexto. Tampoco conviene memoizar por reflejo: cada comparación y cada dependencia agregan complejidad, y el beneficio debe medirse.

El ejemplo filtra una lista con `useMemo`, estabiliza el callback con `useCallback` y usa `memo` en la lista. Así, cuando cambia la selección, la lista no se vuelve a renderizar si sus props no cambiaron.

**`panel-productos.tsx`**
```tsx
import { memo, useCallback, useMemo, useState } from "react";

type Producto = { id: number; nombre: string };

const ListaProductos = memo(function ListaProductos({
  productos,
  onElegir,
}: {
  productos: Producto[];
  onElegir: (id: number) => void;
}) {
  return (
    <ul>
      {productos.map((producto) => (
        <li key={producto.id}>
          <button onClick={() => onElegir(producto.id)}>
            {producto.nombre}
          </button>
        </li>
      ))}
    </ul>
  );
});

export function PanelProductos({ productos }: { productos: Producto[] }) {
  const [consulta, setConsulta] = useState("");
  const [elegido, setElegido] = useState<number | null>(null);

  const visibles = useMemo(
    () =>
      productos.filter((producto) =>
        producto.nombre.toLowerCase().includes(consulta.toLowerCase())
      ),
    [productos, consulta]
  );

  const elegir = useCallback((id: number) => {
    setElegido(id);
  }, []);

  return (
    <>
      <input
        value={consulta}
        onChange={(evento) => setConsulta(evento.target.value)}
        placeholder="Filtrar"
      />
      <ListaProductos productos={visibles} onElegir={elegir} />
      <p>Elegido: {elegido ?? "ninguno"}</p>
    </>
  );
}
```

El error típico es usar `useMemo` para conservar un valor que debe ser correcto siempre. Si se omite una dependencia, la caché devuelve un resultado viejo y la interfaz muestra datos que no corresponden. Otro error es envolver todo en `memo` sin medir: el costo de comparar props puede superar el ahorro, y el componente igual se actualiza por estado o por contexto.

## React Compiler cambió la recomendación

React Compiler alcanzó la versión 1.0 estable el 7 de octubre de 2025, con el paquete `babel-plugin-react-compiler@1.0.0`. Para código nuevo, la recomendación oficial es delegar la memoización al compilador y usar `useMemo` o `useCallback` solo cuando haga falta control fino. La página de `memo` señala que, con el compilador, normalmente ya no se necesita `React.memo`.

Eso no significa que la memoización manual existente deba borrarse a ciegas. En código anterior, la recomendación es revisar, migrar de forma incremental y conservar las optimizaciones que sigan aportando.

> [!warning]
> «Memoizar todo» no es la recomendación actual. La memoización manual tiene costo y puede introducir dependencias incorrectas. El compilador reduce la necesidad de hacerlo a mano; no convierte la memoización indiscriminada en una buena práctica.

## Custom hooks

Un hook propio es una función que reutiliza lógica con estado. No comparte el estado entre componentes: cada llamada crea su propia instancia de estado y sus propios Effects. Lo que se comparte es el código que describe cómo se lee, se actualiza o se sincroniza ese estado.

El nombre debe empezar con `use` para que las reglas de los hooks y las herramientas de análisis lo reconozcan. Si la función no llama a ningún hook, no debe llevar el prefijo; un nombre `use` que no usa hooks confunde sobre su comportamiento y puede habilitar llamadas en lugares que no corresponden.

Un caso útil es retrasar un valor mientras el usuario escribe. El hook encapsula el temporizador y el cleanup; el componente solo recibe el valor estabilizado.

**`use-valor-debounced.ts`**
```ts
import { useEffect, useState } from "react";

export function useValorDebounced<T>(valor: T, retrasoMs = 300): T {
  const [valorEstable, setValorEstable] = useState(valor);

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      setValorEstable(valor);
    }, retrasoMs);

    return () => window.clearTimeout(temporizador);
  }, [valor, retrasoMs]);

  return valorEstable;
}
```

El hook se usa como cualquier otro. Cada componente que lo invoca obtiene su propio `valorEstable` y su propio temporizador.

**`filtro-busqueda.tsx`**
```tsx
import { useValorDebounced } from "./use-valor-debounced";

export function FiltroBusqueda({ termino }: { termino: string }) {
  const terminoEstable = useValorDebounced(termino, 400);

  return <p>Consulta aplicada: {terminoEstable}</p>;
}
```

El error típico es suponer que dos componentes que llaman al mismo hook comparten el estado. No lo hacen: comparten la lógica, pero cada llamada tiene su propia copia. Otro error es nombrar `use` una función que no llama hooks; el prefijo deja de describir la función y las reglas se vuelven engañosas.

> [!tip]
> Antes de crear un hook propio, comprobar que la lógica realmente se repite o que merece un nombre propio. Un hook que solo envuelve una llamada trivial agrega una capa sin reducir complejidad.
## Manejo de estados

## Qué es el estado de una aplicación

El estado es la información que una interfaz necesita para decidir qué mostrar en un instante dado. No es la interfaz ni el árbol de componentes: es el dato que, cuando cambia, obliga a React a recalcular una parte del árbol. Un contador con valor `3`, una lista de campañas que llegó del servidor, el texto de un buscador y un modal abierto son, todos, estado.

La distinción importa porque cada clase tiene un dueño natural distinto. Guardar en un store global lo que usa un solo componente agrega indirección; guardar en el componente lo que comparten cinco pantallas obliga a duplicar y sincronizar. La mayoría de los problemas de estado no vienen de la herramienta elegida, sino de haber clasificado mal el dato.

### Las cinco clases

| Clase | Qué describe | Dueño habitual | Ejemplo concreto |
| --- | --- | --- | --- |
| Local | Dato que solo usa un componente y sus hijos directos | `useState` | El texto de un buscador |
| Global | Dato que muchas ramas leen y algunas escriben | Context, Zustand, Redux | La sesión y el rol |
| Derivado | Dato calculado a partir de otro estado | Render o `useMemo` | La lista filtrada |
| De servidor | Dato que vive fuera y tiene su propio ciclo de vida | TanStack Query, SWR, RTK Query | Las campañas de la API |
| De UI | Dato efímero de presentación | `useState` local | Un modal abierto |

El estado derivado es el que más se equivoca. Si la lista filtrada se guarda en su propio `useState` y se actualiza con un efecto, aparecen dos fuentes de verdad que pueden desincronizarse. Lo correcto es calcularla durante el render: en un buscador, `query` es estado de UI, `campaigns` llega como estado de servidor y la lista filtrada se obtiene con `campaigns.filter(...)` sin guardarse en ningún lado.

## Context API

Context permite que un valor atraviese el árbol sin pasarlo por props en cada nivel. Se crea con `createContext`, se publica con un provider y se lee con `useContext`.

**theme-context.ts**
```ts
import { createContext, useContext } from 'react';

export type Theme = 'light' | 'dark';
export const ThemeContext = createContext<Theme>('light');

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
```

El valor por defecto de `createContext` es el que recibe un consumidor sin provider por encima. Debe ser un valor válido del tipo, no un sustituto de la validación: si el contexto no puede funcionar sin provider, el hook de consumo debe lanzar un error en lugar de devolver un valor silencioso.

En React 19 el provider se renderiza directamente como componente:

**app.tsx**
```tsx
import { useState } from 'react';
import { ThemeContext, type Theme } from './theme-context';

export function App() {
  const [theme, setTheme] = useState<Theme>('light');
  return (
    <ThemeContext value={theme}>
      <Toolbar onToggle={() => setTheme(theme === 'light' ? 'dark' : 'light')} />
    </ThemeContext>
  );
}
```

La forma anterior, `<ThemeContext.Provider value={theme}>`, sigue funcionando como API legacy. Ambas son válidas; mezclarlas en el mismo archivo solo agrega ruido.

### Cuándo usarlo

Context es correcto cuando el dato es estable durante largos períodos y lo consumen ramas lejanas: tema, idioma, sesión verificada, cliente de una API. También sirve para inyectar dependencias y sustituirlas en pruebas sin tocar los componentes.

### Cuándo no usarlo

- **Datos locales.** Si el valor solo lo usa un componente y su hijo directo, una prop es más simple y explícita.
- **Alto volumen de cambios.** Cada actualización vuelve a renderizar a todos los consumidores; Context no reemplaza a un store para datos que cambian muchas veces por segundo.
- **Problemas de composición.** Si la dificultad es que un intermedio no debería conocer una prop, la solución es `children` o un slot, no un contexto nuevo.

> [!warning]
> El valor de un contexto se compara por identidad. Un objeto creado en línea dentro del provider produce un valor nuevo en cada render y vuelve a renderizar a todos los consumidores. Si el valor es un objeto, memorízalo con `useMemo` o divide el contexto en partes estables.

## Context API con useReducer

Cuando la lógica tiene varias transiciones y conviene describirlas como acciones, `useReducer` con Context separa responsabilidades: el reducer concentra las reglas, el provider las ejecuta y el hook de consumo esconde la mecánica.

**cart-reducer.ts**
```ts
export type CartItem = { id: string; name: string; price: number; quantity: number };
export type CartState = { items: CartItem[] };
export type CartAction =
  | { type: 'added'; item: Omit<CartItem, 'quantity'> }
  | { type: 'removed'; id: string }
  | { type: 'cleared' };

export const initialCartState: CartState = { items: [] };

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'added':
      return { items: [...state.items, { ...action.item, quantity: 1 }] };
    case 'removed':
      return { items: state.items.filter((item) => item.id !== action.id) };
    case 'cleared':
      return initialCartState;
    default:
      return state;
  }
}
```

**cart-context.tsx**
```tsx
import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import { cartReducer, initialCartState, type CartAction, type CartState } from './cart-reducer';
type CartContextValue = { state: CartState; dispatch: Dispatch<CartAction> };
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart debe usarse dentro de CartProvider');
  return context;
}
```

`dispatch` es estable entre renders, así que el `useMemo` solo depende de `state`. Sin memorizar, cualquier cambio del provider re-renderizaría a todos los consumidores aunque su parte del estado no haya cambiado.

El consumo se reduce a `const { state, dispatch } = useCart()`: el componente lee `state.items`, calcula el total con `reduce` y despacha `{ type: 'cleared' }` desde un botón.

## Redux

Redux es una librería de estado con reglas explícitas, apoyada en tres principios:

1. **Una sola fuente de verdad.** Todo el estado vive en un único objeto, el store.
2. **El estado es de solo lectura.** Nada lo modifica directamente; solo se envían acciones que describen qué ocurrió.
3. **Los cambios se producen con funciones puras.** Un reducer recibe el estado anterior y una acción, y devuelve el siguiente.

Sobre esas reglas se apoyan cinco piezas. El **store** guarda el estado y expone `getState`, `dispatch` y `subscribe`. Una **acción** es un objeto con `type` y, opcionalmente, `payload`. El **reducer** aplica la acción de forma pura. `dispatch` envía la acción. Un **selector** extrae una parte del estado para que el componente se suscriba solo a lo que necesita. Versiones actuales: `redux@5.0.1` y `react-redux@9.3.0`.

**counter-reducer.ts**
```ts
export type CounterState = { value: number };
export type CounterAction = { type: 'counter/incremented' };

const initialState: CounterState = { value: 0 };

export function counterReducer(
  state: CounterState = initialState,
  action: CounterAction,
): CounterState {
  switch (action.type) {
    case 'counter/incremented':
      return { value: state.value + 1 };
    default:
      return state;
  }
}
```

**store.ts**
```ts
import { legacy_createStore as createStore } from 'redux';
import { counterReducer } from './counter-reducer';

// Código heredado: en proyectos nuevos usa configureStore.
export const store = createStore(counterReducer);
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

**counter.tsx**
```tsx
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './store';

export function Counter() {
  const value = useSelector((state: RootState) => state.value);
  const dispatch = useDispatch<AppDispatch>();
  return (
    <button onClick={() => dispatch({ type: 'counter/incremented' })}>
      {value}
    </button>
  );
}
```

`react-redux` 9 mantiene `Provider`, `useSelector` y `useDispatch`, así que los componentes no cambian al migrar de versión. Desde 9.1 existe además `.withTypes<T>()`, que crea hooks tipados una sola vez: `useDispatch.withTypes<AppDispatch>()`.

> [!warning]
> Es falso que Redux 5 haya eliminado `createStore`. La función está **deprecada, no removida**: la documentación indica que seguirá funcionando de forma indefinida, y `legacy_createStore` es su alias. Lo que cambió es la recomendación: el reemplazo documentado es `configureStore`. Encontrar `createStore` en código existente no es un error de compilación; es una señal de que ese código no adoptó el camino actual.

Un selector que devuelve un objeto nuevo en cada llamada provoca renders innecesarios, porque `useSelector` compara con igualdad referencial.

## Redux Toolkit

Redux Toolkit (`@reduxjs/toolkit@2.13.0`) es la forma recomendada de escribir Redux hoy. No es una librería distinta: es el conjunto de utilidades oficiales que elimina el boilerplate.

`configureStore` crea el store con tres cosas incluidas: **Immer** dentro de los reducers (permite escribir `state.value += 1` sobre un borrador inmutable), **DevTools** conectadas por defecto y un conjunto de **middleware** predeterminado que detecta mutaciones accidentales y valores no serializables. `createSlice` agrupa nombre, estado inicial y reducers, y genera las acciones automáticamente.

**counter-slice.ts**
```ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: {
    incremented(state) {
      state.value += 1;
    },
    incrementedBy(state, action: PayloadAction<number>) {
      state.value += action.payload;
    },
  },
});

export const { incremented, incrementedBy } = counterSlice.actions;
export const counterReducer = counterSlice.reducer;
```

**store.ts**
```ts
import { configureStore } from '@reduxjs/toolkit';
import { counterReducer } from './counter-slice';

export const store = configureStore({ reducer: { counter: counterReducer } });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

**counter.tsx**
```tsx
import { useDispatch, useSelector } from 'react-redux';
import { incremented, incrementedBy } from './counter-slice';
import type { AppDispatch, RootState } from './store';

const useAppDispatch = useDispatch.withTypes<AppDispatch>();
const useAppSelector = useSelector.withTypes<RootState>();

export function Counter() {
  const value = useAppSelector((state) => state.counter.value);
  const dispatch = useAppDispatch();
  return (
    <>
      <span>{value}</span>
      <button onClick={() => dispatch(incremented())}>+1</button>
      <button onClick={() => dispatch(incrementedBy(5))}>+5</button>
    </>
  );
}
```

### Lógica asíncrona con createAsyncThunk

`createAsyncThunk` sigue vigente para efectos asíncronos que no son caché de servidor: enviar un formulario, registrar un evento, ejecutar una operación que después hay que reflejar en el store. Para leer y cachear datos de una API, la recomendación oficial es RTK Query.

**counter-thunks.ts**
```ts
import { createAsyncThunk } from '@reduxjs/toolkit';
export const fetchCounter = createAsyncThunk<number, void>(
  'counter/fetch',
  async () => {
    const response = await fetch('/api/counter');
    if (!response.ok) throw new Error('No se pudo leer el contador');
    const data = (await response.json()) as { value: number };
    return data.value;
  },
);
```

El thunk genera tres acciones —`pending`, `fulfilled` y `rejected`— que se manejan en `extraReducers` con `builder.addCase(...)`. En `fulfilled` se toma `action.payload`, que es el valor devuelto por la función asíncrona.

> [!tip]
> Con RTK deja de tener sentido escribir acciones a mano. Si un archivo repite constantes `*_REQUEST`, `*_SUCCESS` y `*_FAILURE`, ese código es candidato directo a `createAsyncThunk`.

## RTK Query

RTK Query es la capa de datos de Redux Toolkit; se importa desde `@reduxjs/toolkit/query/react` para obtener los hooks generados. Resuelve el ciclo completo de un dato de servidor: fetching, caché, deduplicación, invalidación y estados de carga.

`createApi` declara los endpoints, `fetchBaseQuery` es el `baseQuery` recomendado y `tagTypes` define las familias de etiquetas que usan `providesTags` e `invalidatesTags` para marcar datos obsoletos.

**campaigns-api.ts**
```ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export type Campaign = { id: string; name: string; goal: number };
export const campaignsApi = createApi({
  reducerPath: 'campaignsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Campaign'],
  endpoints: (build) => ({
    listCampaigns: build.query<Campaign[], void>({
      query: () => '/campaigns',
      providesTags: [{ type: 'Campaign', id: 'LIST' }],
    }),
    createCampaign: build.mutation<Campaign, { name: string; goal: number }>({
      query: (body) => ({ url: '/campaigns', method: 'POST', body }),
      invalidatesTags: [{ type: 'Campaign', id: 'LIST' }],
    }),
  }),
});

export const { useListCampaignsQuery, useCreateCampaignMutation } = campaignsApi;
```

El wiring del store necesita **dos** entradas, no una. El reducer guarda la caché y el middleware gestiona su ciclo de vida:

**store.ts**
```ts
import { configureStore } from '@reduxjs/toolkit';
import { campaignsApi } from './campaigns-api';

export const store = configureStore({
  reducer: { [campaignsApi.reducerPath]: campaignsApi.reducer },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(campaignsApi.middleware),
});
```

> [!warning]
> Si agregas el reducer pero olvidas el middleware, los hooks compilan y las peticiones salen, pero la caché deja de gestionarse: `providesTags` e `invalidatesTags` no surten efecto, no hay refetch al volver a montar y se pierden las suscripciones y el polling. Es el error de configuración más común con RTK Query y no produce ningún aviso en tiempo de compilación.

Cada endpoint genera un hook: `useListCampaignsQuery()` devuelve `{ data, isLoading, isError }` y `useCreateCampaignMutation()` devuelve la función de escritura junto con su propio `isLoading`. La mutación invalida la etiqueta `LIST`, y eso hace que la query se vuelva a ejecutar sola. La relación entre ambos endpoints se declara una vez, en la API.

## TanStack Query

TanStack Query (`@tanstack/react-query@5.104.5`) gestiona estado de servidor sin imponer una arquitectura de estado global. No reemplaza a `useState`: reemplaza la costumbre de guardar respuestas de la API en el store.

En la versión 5 todas las funciones reciben **un solo objeto**. La firma `useQuery({ queryKey, queryFn })` reemplazó a la forma posicional, y lo mismo ocurre con `useMutation`. El cliente se crea una vez y se publica con `QueryClientProvider`.

**main.tsx**
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}><App /></QueryClientProvider>,
);
```

**use-campaigns.ts**
```ts
import { useQuery } from '@tanstack/react-query';
import type { Campaign } from './campaigns-api';

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const response = await fetch('/api/campaigns');
      if (!response.ok) throw new Error('No se pudo leer la lista');
      return (await response.json()) as Campaign[];
    },
  });
}
```

`queryKey` es la identidad de la entrada en caché. Cambiar la clave cambia el dato; por eso las claves incluyen los parámetros de los que depende la consulta, por ejemplo `['campaigns', { page }]`.

**use-create-campaign.ts**
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; goal: number }) => {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error('No se pudo crear la campaña');
      return (await response.json()) as { id: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}
```

> [!note]
> `useQueryClient` también permite leer y escribir la caché con `getQueryData` y `setQueryData`. Esa vía sirve para actualizaciones optimistas; para el caso normal, invalidar y dejar que la query se refresque es más simple.

## SWR

SWR (`swr@2.5.1`) parte de la misma idea con una API más compacta: la clave identifica el recurso y el fetcher lo obtiene. El nombre viene de stale-while-revalidate: se muestra el dato en caché y se revalida en segundo plano.

La forma tipada correcta lleva el tipo como parámetro genérico del hook, sin espacios ni comparaciones:

**use-user.ts**
```ts
import useSWR from 'swr';

export type User = { id: string; name: string };
const fetcher = async (url: string): Promise<User> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('No se pudo leer el usuario');
  return (await response.json()) as User;
};

export function useUser(uid: string) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<User, Error>(
    uid ? `/api/users/${uid}` : null,
    fetcher,
  );
  return { user: data, error, isLoading, isValidating, refresh: mutate };
}
```

> [!warning]
> La forma `useSWR < User > ('/api/user', fetcher)` que aparece en material antiguo no compila: el parser la interpreta como una comparación. Lo correcto es `useSWR<User>('/api/user', fetcher)` o, si también se necesita el tipo del error, `useSWR<User, Error>(uid, fetcher)`.

### isLoading e isValidating

Los dos indicadores no significan lo mismo, y confundirlos produce pantallas de carga que parpadean en cada revalidación.

| Indicador | Cuándo es `true` |
| --- | --- |
| `isLoading` | Solo en la petición inicial, sin dato en caché |
| `isValidating` | En la carga inicial y en toda revalidación |

La regla práctica: `isLoading` sirve para el estado vacío de la primera visita; `isValidating` sirve para un indicador discreto sobre datos que ya están en pantalla. `mutate` revalida la clave y devuelve una `Promise` con el dato actualizado; se puede llamar desde el hook o de forma global importándolo del paquete con la clave como primer argumento.

## Zustand

Zustand (`zustand@5.0.16`) es un store mínimo basado en suscripciones. No necesita provider, acciones ni reducers, y cada componente se suscribe solo a la porción que selecciona.

En la versión 5 la creación se escribe con la forma currificada, que separa la inferencia del tipo de la función creadora:

**cart-store.ts**
```ts
import { create } from 'zustand';

export type CartState = {
  items: string[];
  add: (id: string) => void;
};

export const useCartStore = create<CartState>()((set) => ({
  items: [],
  add: (id) => set((state) => ({ items: [...state.items, id] })),
}));
```

**cart-badge.tsx**
```tsx
import { useCartStore } from './cart-store';

export function CartBadge() {
  const count = useCartStore((state) => state.items.length);
  const add = useCartStore((state) => state.add);
  return <button onClick={() => add('nuevo')}>Agregar — {count}</button>;
}
```

El selector es obligatorio en la práctica. Llamar a `useCartStore()` sin selector suscribe el componente al store completo y lo re-renderiza ante cualquier cambio, incluidos los que no le importan.

### Una store por montaje

La forma anterior crea un singleton de módulo: una sola store para toda la aplicación. Sirve para estado global, pero es un problema cuando la store debe tener un ciclo de vida propio, por ejemplo una instancia por pantalla o por prueba.

Para ese caso existe `zustand/vanilla`, que crea la store sin el hook de React, y el tipo `StoreApi` que devuelve. La store se instancia dentro de un provider con `useState(() => createStore(...))`, de modo que cada montaje obtiene la suya.

**cart-store-provider.tsx**
```tsx
import { createContext, useContext, useState, type ReactNode } from 'react';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
export type CartState = { items: string[]; add: (id: string) => void };

const CartStoreContext = createContext<StoreApi<CartState> | null>(null);

export function CartStoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() =>
    createStore<CartState>()((set) => ({
      items: [],
      add: (id) => set((state) => ({ items: [...state.items, id] })),
    })),
  );
  return <CartStoreContext value={store}>{children}</CartStoreContext>;
}

export function useCartStore<T>(selector: (state: CartState) => T): T {
  const store = useContext(CartStoreContext);
  if (!store) throw new Error('useCartStore requiere CartStoreProvider');
  return useStore(store, selector);
}
```

> [!warning]
> La store debe crearse perezosamente dentro de `useState`. Escribir `createStore(...)` directamente en el cuerpo del provider crea una store nueva en cada render: el estado se pierde y los consumidores quedan suscritos a instancias distintas. El patrón de módulo, en cambio, nunca debe usarse para estado que pertenece a una pantalla, porque sobrevive al desmontaje y filtra datos entre montajes.

## Jotai

Jotai (`jotai@3.0.1`) modela el estado como átomos independientes. Cada átomo es una unidad de estado y los componentes se suscriben solo a los que usan, sin provider global: el `Provider` es opcional y sirve para aislar un subárbol.

**cart-atoms.ts**
```ts
import { atom } from 'jotai';

export const itemsAtom = atom<string[]>([]);
export const addItemAtom = atom(null, (get, set, id: string) => {
  set(itemsAtom, [...get(itemsAtom), id]);
});
export const countAtom = atom((get) => get(itemsAtom).length);
```

**cart-badge.tsx**
```tsx
import { useAtom } from 'jotai';
import { countAtom, itemsAtom } from './cart-atoms';

export function CartBadge() {
  const [items] = useAtom(itemsAtom);
  const [count] = useAtom(countAtom);
  return <span>{count} productos de {items.length}</span>;
}
```

`useAtom` devuelve el par valor y setter; cuando el componente solo necesita uno de los dos, puede desestructurar únicamente la mitad que usa.

### Jotai frente a Zustand

El posicionamiento oficial distingue los dos enfoques por el lugar donde vive el estado:

> [!note]
> «If you need a replacement for useState+useContext, Jotai fits well. If you want a simple module state, Zustand fits well... If you want to make use of Suspense, Jotai is the one.»

En términos prácticos: Jotai es **contexto-primero** —el estado se define cerca de donde se consume y el árbol delimita su alcance— mientras que Zustand es **módulo-primero**: la store vive en un módulo y se importa desde cualquier lugar. Jotai además se integra de forma natural con Suspense, porque un átomo asíncrono puede suspender al componente que lo lee.

## Qué herramienta elegir

| Escenario | Herramienta | Motivo |
| --- | --- | --- |
| Estado local | `useState` / `useReducer` | No hay nada que compartir |
| UI compartida | Context, Zustand o Jotai | Context si es estable y jerárquico; Zustand o Jotai si cambia seguido |
| Servidor simple | SWR o TanStack Query | Caché y revalidación sin escribir un store |
| Servidor complejo | TanStack Query o RTK Query | Invalidación por etiquetas, mutaciones, paginación |
| Redux existente | Redux Toolkit + RTK Query | Aprovecha el store y las DevTools ya instaladas |
| Código dividido | Zustand, Jotai o Redux | El estado no depende del árbol; un chunk posterior accede al mismo store |

Dos criterios desempatan. Si el equipo ya domina Redux y necesita trazabilidad de cada acción, RTK es la opción con mejor respaldo. Si el problema central es la caché de datos remotos y el estado local es mínimo, una librería de servidor alcanza y no hace falta un store global.

> [!tip]
> No mezcles dos librerías de estado de servidor. TanStack Query, SWR y RTK Query resuelven lo mismo con modelos distintos; convivir con dos duplica la caché y las invalidaciones.

## Compartir información entre componentes

La comunicación se resuelve según la relación entre los componentes. La regla general es usar el mecanismo más simple que cubra el caso y subir de nivel solo cuando el anterior se vuelve incómodo.

### De padre a hijo

La vía directa son las props: el padre pasa el dato y el hijo lo recibe tipado. Cuando el dato debe atravesar varios niveles que no lo usan, aparece el **prop drilling**: una cadena donde los intermedios solo hacen de puente. Si `Page` tiene el usuario y `UserMenu` lo necesita, pasar `user` y `onLogin` por `Layout` y por `Header` obliga a que ambos declaren props que nunca leen.

La solución preferida es la **composición**: en lugar de empujar el dato hacia abajo, se pasa el elemento ya construido como `children` o como slot.

**page.tsx**
```tsx
export function Page() {
  const [user, setUser] = useState<User | null>(null);
  return (
    <Layout header={<UserMenu user={user} onLogin={setUser} />}>
      <Dashboard />
    </Layout>
  );
}

function Layout({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <main><header>{header}</header>{children}</main>
  );
}
```

`Layout` dejó de conocer el usuario: recibe piezas ya resueltas y se limita a ubicarlas.

### Entre hermanos

Dos componentes del mismo nivel no se hablan entre sí: comparten a través de un ancestro común.

- **Elevar el estado.** El padre guarda el dato y lo pasa a ambos hijos junto con la función que lo modifica. Es la solución más simple y la primera que conviene intentar.
- **Context.** Cuando el ancestro común está lejos o la cadena de intermediarios es larga, el valor se publica en un contexto y cada hermano lo consume.
- **Observable.** Cuando el dato cambia con alta frecuencia o el emisor vive fuera del árbol de React, un observable como `BehaviorSubject` de RxJS desacopla emisor y receptores. Es una decisión de arquitectura, no un atajo: exige suscribirse en un efecto y limpiar la suscripción al desmontar, o cada montaje deja una suscripción viva.

### Por qué composición antes que Context para layout

Un contexto de layout suele nacer de una necesidad concreta: el sidebar necesita saber si está colapsado y el contenido ajustar sus márgenes. La tentación es crear un `LayoutContext` con `collapsed` y `toggle`, y hacer que todos los descendientes lo consuman.

Ese contexto acopla cada componente del layout a una decisión de presentación y vuelve a renderizar a todos los consumidores cuando cambia. La alternativa es que el layout reciba sus piezas y decida dónde ponerlas:

**dashboard-layout.tsx**
```tsx
export function DashboardLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div data-collapsed={collapsed}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main>{children}</main>
    </div>
  );
}
```

Solo `Sidebar` conoce `collapsed`; el resto del árbol no se entera del cambio porque no está suscrito a nada. Si el contenido necesita reaccionar al ancho, conviene resolverlo con CSS —una clase en el contenedor y variables— antes que con estado compartido. La misma lógica aplica a modales y paneles: un componente que recibe `children` no necesita saber qué hay dentro.

> [!note]
> Context sigue siendo la herramienta correcta para valores transversales y estables, como el tema o la sesión. La composición gana cuando el problema es de **estructura**: quién envuelve a quién y dónde se ubica cada pieza.
## Enrutamiento

## Enrutamiento del lado del cliente

Una aplicación de una sola página entrega un documento HTML y un paquete de JavaScript. Después de la primera carga, el router escucha los cambios de la URL, renderiza el componente correspondiente y actualiza el historial del navegador. La navegación no vuelve a pedir una página completa, así que se conserva el estado de la interfaz y se evita una recarga.

El servidor sigue distinguiendo entre archivos, endpoints de API y rutas de la aplicación. Cuando llega una solicitud a `/dashboard/projects/42`, no debe buscar un archivo con ese nombre: debe responder con el `index.html` de la aplicación y dejar que el router resuelva la vista. Sin ese fallback, una recarga o un enlace directo devuelven un error del servidor aunque la ruta exista en el cliente.

> [!note]
> El fallback a `index.html` se aplica solo a las rutas de la aplicación. Los endpoints de API y los archivos estáticos conservan su propio manejo; enviarles HTML produciría respuestas incorrectas.

El router no resuelve la autorización del servidor, la validación de datos, la protección de una sesión ni la decisión de qué información puede ver una persona. Tampoco reemplaza la carga de datos, la división del código o el manejo de errores de red. Una ruta protegida en el cliente mejora la experiencia, pero no es un control de acceso: cada solicitud al backend debe autorizarse por separado.

## React Router

React Router 8 es el major actual. Al cierre de esta nota, `react-router@8.5.0` ocupa el tag `latest`; la versión 7 sigue publicada como `version-7` en 7.18.4. La versión 8 requiere `react >= 19.2.7` y `node >= 22.22.0`.

Los ejemplos importan de `"react-router"`, el paquete de entrada que muestra la documentación actual. No se usa `"react-router-dom"` en este artículo.

| Modo | Punto de entrada | Criterio de elección |
| --- | --- | --- |
| Declarativo | `<BrowserRouter>` y `<Routes>` | Rutas simples, poca carga de datos asociada a la navegación y adopción gradual |
| Data | `createBrowserRouter` y `<RouterProvider>` | Loaders, acciones, estados pendientes y errores por ruta |
| Framework | Plugin de Vite, `routes.ts` y Route Module API | Una aplicación con convenciones de framework y módulos de ruta |

La elección práctica consiste en comenzar por el modo declarativo cuando la aplicación solo necesita componer vistas. El modo data conviene cuando la navegación debe coordinar la carga o el envío de datos antes de renderizar. El modo framework se elige cuando se quiere la capa completa del plugin de Vite y sus convenciones de archivos, no como un reemplazo del modo declarativo, que sigue oficialmente soportado. La documentación también menciona dos modos RSC inestables; quedan fuera de este recorrido.

> [!tip]
> Si una aplicación no necesita esperar datos para cambiar de pantalla, el modo declarativo evita introducir loaders, acciones y estados pendientes sin una razón concreta.

## Rutas declarativas

`<BrowserRouter>` envuelve la aplicación y conecta el router con la URL. `<Routes>` elige la coincidencia y `<Route>` asocia un `path` con un `element`. El `element` recibe un elemento de React, no una referencia al componente. `<Switch>` fue reemplazado por `<Routes>` en la versión 6.

**src/main.tsx**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
```

La ruta comodín `path="*"` cubre las direcciones que no coinciden con ninguna otra. Sin esa ruta, una dirección desconocida no tiene una pantalla que la explique.

## Navegación con Link y NavLink

`<Link to>` produce un enlace que el router intercepta para evitar una recarga completa. Es la opción adecuada para la navegación declarativa: conserva el estado de la aplicación y participa del historial. `<NavLink>` agrega información sobre la ruta activa, útil para menús.

`activeClassName` y `activeStyle` se eliminaron en la versión 6. Hoy el estado se calcula con una función en `className`, que recibe `isActive` y `isPending`.

**src/components/MainNav.tsx**

```tsx
import { Link, NavLink } from "react-router";

export function MainNav() {
  return (
    <nav aria-label="Principal">
      <Link to="/">Inicio</Link>
      <NavLink
        to="/dashboard"
        className={({ isActive, isPending }) =>
          isActive ? "nav-link nav-link--active" : isPending ? "nav-link nav-link--pending" : "nav-link"
        }
      >
        Panel
      </NavLink>
    </nav>
  );
}
```

> [!warning]
> `activeClassName` ya no aplica estilos en la API actual. El patrón anterior y su reemplazo son:
>
> **src/components/MainNav.tsx**
>
> ```tsx
> // Forma anterior, eliminada en la versión 6:
> <NavLink to="/dashboard" activeClassName="active">Panel</NavLink>
>
> // Forma actual:
> <NavLink to="/dashboard" className={({ isActive }) => isActive ? "active" : ""}>Panel</NavLink>
> ```

`isPending` describe una navegación que todavía está en curso y resulta útil en el modo data. No es un estado global de carga: solo indica la transición de la ruta enlazada. Para una acción que no es un enlace, como enviar un formulario o cerrar una sesión, conviene usar navegación programática.

## Layouts anidados con Outlet

Una ruta padre puede declarar un layout y dejar que sus rutas hijas se rendericen dentro mediante `<Outlet />`. Así se comparte cabecera, navegación o contenedor sin repetir el marcado. La ruta `index` coincide con la ruta del padre y representa su vista inicial.

**src/layouts/AppLayout.tsx**

```tsx
import { Outlet } from "react-router";

export function AppLayout() {
  return (
    <div className="app-shell">
      <header>Vaqcrow</header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
```

**src/App.tsx**

```tsx
<Routes>
  <Route path="/" element={<AppLayout />}>
    <Route index element={<HomePage />} />
    <Route path="login" element={<LoginPage />} />
    <Route path="dashboard" element={<DashboardPage />} />
  </Route>
</Routes>
```

Las rutas hijas no llevan una barra inicial: `login` y `dashboard` son relativas al padre. Un layout no carga datos por sí mismo; solo compone la interfaz. Si la carga debe ocurrir antes de renderizar, esa responsabilidad pertenece al modo data.

## useNavigate, useParams y useSearchParams

`useNavigate` devuelve una función para cambiar de ruta desde un evento. Se usa después de una acción, no para reemplazar un enlace visible. Un botón que envía un formulario y luego vuelve al panel es un caso típico.

**src/components/BackToDashboard.tsx**

```tsx
import { useNavigate } from "react-router";

export function BackToDashboard() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate("/dashboard")}>Volver al panel</button>;
}
```

`useParams` entrega los segmentos dinámicos de la URL. El router los expone como texto, así que el tipado útil se construye en la frontera: se valida el valor y se convierte en un tipo que el resto del componente puede usar sin dudas.

**src/pages/ProjectDetailPage.tsx**

```tsx
import { useParams } from "react-router";

type ProjectId = string & { readonly __brand: "ProjectId" };

const parseProjectId = (value: string | undefined): ProjectId | null =>
  value && /^[a-z0-9-]+$/.test(value) ? (value as ProjectId) : null;

export function ProjectDetailPage() {
  const { id } = useParams();
  const projectId = parseProjectId(id);
  return projectId ? <p>Proyecto: {projectId}</p> : <p>Identificador no válido.</p>;
}
```

`useSearchParams` lee y escribe la query string. Cuando un filtro o una página deben poder compartirse por enlace, la URL es la fuente de verdad: no se duplica en un `useState` que puede quedar desincronizado. Al escribir, conviene copiar los parámetros actuales para no borrar otras claves.

**src/pages/ProjectListPage.tsx**

```tsx
import { useSearchParams } from "react-router";

export function ProjectListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  };

  return <section><p>Página {page}</p><button type="button" onClick={() => goToPage(page + 1)}>Siguiente</button></section>;
}
```

## Data router

El modo data se construye con `createBrowserRouter` y `<RouterProvider>`. Cada ruta puede declarar un `loader`, que se ejecuta antes de renderizar, y un `errorElement`, que captura los errores de esa rama. El router coordina la navegación con la carga y puede exponer estados pendientes mientras el loader trabaja.

**src/router.tsx**

```tsx
import { createBrowserRouter, RouterProvider } from "react-router";
import { RootLayout } from "./layouts/RootLayout";
import { HomePage } from "./pages/HomePage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { RouteErrorPage } from "./pages/RouteErrorPage";

type Project = { id: string; name: string };

async function projectsLoader(): Promise<Project[]> {
  const response = await fetch("/api/projects", { credentials: "include" });
  if (!response.ok) throw new Error(`No se pudo cargar el listado (${response.status})`);
  return response.json() as Promise<Project[]>;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "projects", element: <ProjectsPage />, loader: projectsLoader },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
```

El `errorElement` más cercano recibe el fallo y evita que una ruta rota derribe toda la aplicación. El componente de la ruta lee el resultado del loader mediante el mecanismo de datos del router; el ejemplo no necesita conocer ese detalle para mostrar la configuración.

El modo data conviene cuando la navegación debe esperar datos, cuando varias rutas comparten una carga o cuando se quieren errores y estados pendientes por ruta. El modo declarativo sigue siendo más simple cuando la carga vive en los componentes y no depende de la transición. El ejemplo completo usa el declarativo.

## Rutas protegidas

La protección se implementa con un componente que envuelve `<Outlet />` y decide si renderiza el contenido o redirige con `<Navigate />`. El estado de autenticación debe vivir en un Context o en un store, no leerse de `localStorage` durante el render. Un valor externo y mutable no notifica cambios a React y el cliente puede editarlo.

**src/auth/AuthContext.tsx**

```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Status = "loading" | "authenticated" | "anonymous";
type AuthState = { status: Status; refreshSession: () => Promise<void> };

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");

  const refreshSession = useCallback(async () => {
    const response = await fetch("/api/session", { credentials: "include" }).catch(() => null);
    setStatus(response?.ok ? "authenticated" : "anonymous");
  }, []);

  useEffect(() => { void refreshSession(); }, [refreshSession]);

  return <AuthContext.Provider value={{ status, refreshSession }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return value;
}
```

**src/routes/ProtectedLayout.tsx**

```tsx
import { Navigate, Outlet } from "react-router";
import { useAuth } from "../auth/AuthContext";

export function ProtectedLayout() {
  const { status } = useAuth();
  if (status === "loading") return <p>Cargando sesión...</p>;
  if (status === "anonymous") return <Navigate to="/login" replace />;
  return <Outlet />;
}
```

El estado `loading` evita redirigir antes de saber si existe una sesión. `<Navigate replace />` cambia la ubicación sin agregar una entrada nueva al historial.

> [!warning]
> Guardar un token de sesión en `localStorage` lo deja al alcance de cualquier script que se ejecute en la página. Un ataque XSS puede leerlo y enviarlo fuera del navegador. La opción recomendada es una cookie `HttpOnly` emitida por el backend, acompañada de `Secure` y `SameSite`; el frontend no lee el token, solo consulta el estado de sesión. `HttpOnly` impide el acceso desde JavaScript, pero no reemplaza la autorización en el servidor.

## Un ejemplo completo

El árbol integra las piezas anteriores: un layout público para el ingreso, un layout protegido para el panel, una ruta `index`, un listado, un detalle con parámetro y una pantalla 404. El punto de entrada mantiene `<BrowserRouter>` y el estado de sesión se consulta al backend.

**src/App.tsx**

```tsx
import { Navigate, Route, Routes } from "react-router";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedLayout } from "./routes/ProtectedLayout";
import { PublicLayout } from "./layouts";
import { DashboardHome, LoginPage, NotFoundPage } from "./pages";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { ProjectListPage } from "./pages/ProjectListPage";

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route path="/dashboard" element={<ProtectedLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="projects" element={<ProjectListPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
```

**src/layouts.tsx**

```tsx
import { Outlet } from "react-router";

export function PublicLayout() {
  return <main className="public-shell"><Outlet /></main>;
}
```

**src/pages.tsx**

```tsx
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useAuth } from "./auth/AuthContext";

export function LoginPage() {
  const navigate = useNavigate();
  const { status, refreshSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) return;
    await refreshSession();
    navigate("/dashboard", { replace: true });
  }

  if (status === "authenticated") return <Navigate to="/dashboard" replace />;

  return (
    <form onSubmit={handleSubmit}>
      <h1>Ingresar</h1>
      <input aria-label="Correo" value={email} onChange={(event) => setEmail(event.target.value)} />
      <input aria-label="Contraseña" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      <button type="submit">Entrar</button>
    </form>
  );
}

export function DashboardHome() {
  return <section><h1>Panel</h1><Link to="/dashboard/projects">Ver proyectos</Link></section>;
}

export function NotFoundPage() {
  return <section><h1>Página no encontrada</h1><Link to="/dashboard">Ir al panel</Link></section>;
}
```

El layout público no exige sesión; el protegido la consulta antes de renderizar. El listado y el detalle con parámetro reutilizan los componentes de la sección de hooks, y la ruta 404 cubre cualquier dirección ajena al árbol. El backend sigue autorizando cada solicitud: renderizar una ruta no concede acceso.
## Datos, formularios y estilos

## Axios

La línea 1 es la actual de Axios; la versión verificada para esta nota es `axios@1.20.0`. La librería envuelve el transporte del navegador, serializa el cuerpo, interpreta la respuesta y expone una API uniforme. Esa comodidad explica su presencia en tantos proyectos y también la necesidad de decidir dónde se configura antes de escribir la primera llamada.

`axios.get`, `axios.post` y el resto de los métodos del objeto importado usan una configuración global compartida. Esa configuración es estado de módulo: cualquier archivo que modifique `axios.defaults` afecta a todas las llamadas del proceso. Un `baseURL` para la API principal, un header de una integración puntual o un timeout distinto terminan conviviendo en el mismo objeto, y el orden de importación empieza a importar. La alternativa es crear una instancia con `axios.create`: tiene su propia configuración y sus propios interceptores, y el resto de la aplicación la importa sin tocar la global. Si aparece una segunda API con otro dominio, otro timeout u otra política de credenciales, se crea otra instancia y las dos no se pisan.

**src/lib/axios.ts**

```ts
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3001",
  timeout: 10_000,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});
```

`baseURL` se antepone a las rutas relativas, así que los servicios escriben `/campaigns` y no repiten el host. Los headers declarados son valores por defecto: se combinan con los de cada solicitud y pueden sobrescribirse en la llamada puntual. El token de sesión no se declara en la creación porque cambia durante la vida de la aplicación; para eso están los interceptores.

## Interceptores

Un interceptor es una función que Axios ejecuta antes de enviar una solicitud o después de recibir una respuesta. Se registra sobre la instancia y devuelve un identificador numérico. La firma es `axios.interceptors.request.use(onFulfilled, onRejected)` y la equivalente `axios.interceptors.response.use(onFulfilled, onRejected)`. El segundo argumento es opcional, pero en la práctica casi siempre se usa.

El orden de ejecución no es el de registro. Los interceptores de solicitud se ejecutan en orden inverso al registro, como una pila: el último registrado corre primero. Los de respuesta se ejecutan en el orden de registro, como una cola. La solicitud se arma apilando transformaciones y la respuesta se desarma en el mismo orden en que se encadenaron. Conocer esa asimetría importa cuando un interceptor depende del trabajo de otro.

El primer caso real es inyectar el token de sesión. El interceptor lee la credencial desde el store en el momento de la llamada, no desde una constante capturada al importar el módulo. Así una renovación de sesión se refleja en la solicitud siguiente sin reiniciar la aplicación. El segundo caso es renovar la sesión una sola vez: si cinco solicitudes reciben `401` a la vez, no conviene disparar cinco renovaciones, porque la primera renueva el token y las otras trabajan con un valor viejo.

**src/lib/axios.ts**

```ts
import axios, { type InternalAxiosRequestConfig } from "axios";
import { authClient } from "./auth-client";
import { sessionStore } from "../state/session-store";

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const { data } = await authClient.post<{ accessToken: string }>("/auth/refresh");
  sessionStore.getState().setAccessToken(data.accessToken);
  return data.accessToken;
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3001",
});

api.interceptors.request.use((config) => {
  const token = sessionStore.getState().accessToken;
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const original = error.config as (InternalAxiosRequestConfig & { retried?: boolean }) | undefined;
    if (!original || original.retried) return Promise.reject(error);

    original.retried = true;
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });

    const token = await refreshPromise;
    original.headers.set("Authorization", `Bearer ${token}`);
    return api.request(original);
  },
);
```

La variable `refreshPromise` funciona como un candado de vuelo único. La primera llamada crea la `Promise`; las siguientes reutilizan la misma. Cuando termina, la referencia se limpia y la próxima ola puede renovar de nuevo. La marca `retried` evita el bucle infinito: si la solicitud repetida vuelve a recibir `401`, el interceptor la rechaza en lugar de renovar otra vez. Además, la renovación se hace con `authClient`, una instancia separada sin este interceptor; si el refresh pasara por la misma instancia, un refresh inválido dispararía otro refresh. El tercer caso es normalizar errores: el interceptor de respuesta ve todas las respuestas de la instancia, así que es el lugar natural para convertir cualquier fallo en un tipo propio antes de que llegue al componente.

Un interceptor se puede quitar. `api.interceptors.request.eject(id)` y `api.interceptors.response.eject(id)` eliminan uno por su identificador. `api.interceptors.request.clear()` y `api.interceptors.response.clear()` eliminan todos los de ese lado. El uso típico es una prueba que registra un interceptor temporal y lo quita al terminar, o una pantalla que necesita un comportamiento distinto mientras está montada.

> [!note]
> El término correcto es **interceptor**. El documento original de esta serie decía "Interrupt", que no es el nombre de la API ni el de la función. Axios registra interceptores; la cancelación de una petición es un mecanismo distinto, con `AbortController` y `AbortSignal`.

## Cancelación de peticiones

Una petición puede quedar obsoleta antes de responder: el usuario cambia el término de búsqueda, abandona la pantalla o navega a otra ruta. Si la respuesta llega después, el componente puede escribir estado que ya no corresponde o mostrar datos de una consulta anterior. Cancelar no acelera la red; evita aplicar un resultado que ya no interesa.

El mecanismo actual es `AbortController`. Se crea un controlador, se pasa su `signal` en la configuración de la solicitud y se llama a `abort()` cuando el resultado deja de ser útil. Axios soporta `config.signal` desde la versión `0.22.0`. En React, el lugar natural para abortar es la función de limpieza de un `useEffect`: se ejecuta al desmontar y antes de la siguiente ejecución del efecto.

**src/features/campaigns/useCampaignSearch.ts**

```tsx
import { useEffect, useState } from "react";
import axios from "axios";
import { api } from "../../lib/axios";
import type { Campaign } from "../../types/campaign";

export function useCampaignSearch(term: string) {
  const [items, setItems] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    api
      .get<Campaign[]>("/campaigns", { params: { q: term }, signal: controller.signal })
      .then(({ data }) => setItems(data))
      .catch((caught: unknown) => {
        if (axios.isCancel(caught)) return;
        setError("No se pudo cargar el listado.");
      });

    return () => controller.abort();
  }, [term]);

  return { items, error };
}
```

Una petición cancelada no resuelve: rechaza. El rechazo es un `CanceledError` con `code: "ERR_CANCELED"`. Por eso el `catch` debe distinguir la cancelación del fallo real antes de escribir un mensaje de error. `axios.isCancel(caught)` es el helper documentado para esa comprobación; también se puede verificar la instancia de `CanceledError` y su código, aunque `isCancel` es más directo.

El controlador debe ser propio de cada ejecución del efecto. Uno creado fuera del efecto se reutiliza entre búsquedas y aborta la solicitud nueva junto con la vieja; crearlo dentro del efecto y llamar a `abort()` en la limpieza mantiene el ciclo de vida alineado con el de la consulta.

> [!warning]
> `CancelToken` está **deprecado, no eliminado**. La documentación de Axios lo marca para eliminación en el próximo major y sigue presente en la línea 1.x. El código antiguo que usa `axios.CancelToken.source()` y `source.cancel()` puede seguir funcionando, pero no es el camino para código nuevo: la API vigente es `AbortController` con `signal`. No se muestra aquí como recomendación.

## Manejo de errores

En TypeScript, un `catch` recibe `unknown` porque cualquier cosa puede lanzarse, y Axios no cambia esa regla. El helper documentado para reducir el tipo es `axios.isAxiosError(error)`. Devuelve un predicado que permite acceder a `response`, `request`, `config` y `code` sin castear a mano.

La forma del error distingue tres situaciones. Si existe `error.response`, el servidor respondió con un estado fuera del rango 2xx: hay código HTTP, headers y cuerpo. Si existe `error.request` pero no `error.response`, la solicitud salió y no hubo respuesta: red caída, DNS, CORS o timeout. Si no existe ninguno de los dos, el problema ocurrió antes de enviar. Cada caso merece un mensaje distinto, porque la acción del usuario también es distinta.

El primer paso es definir un error de dominio. El componente no debería conocer códigos HTTP ni la forma de Axios. El dominio expone un código estable y un mensaje apto para mostrar; el detalle técnico, incluido un identificador de correlación, se conserva para diagnóstico.

**src/lib/api-error.ts**

```ts
export type ApiErrorCode = "unauthorized" | "not_found" | "validation" | "network" | "unknown";

const messages: Record<ApiErrorCode, string> = {
  unauthorized: "La sesión expiró. Vuelve a ingresar.",
  not_found: "El recurso solicitado ya no existe.",
  validation: "Revisa los datos enviados.",
  network: "No hay conexión con el servidor.",
  unknown: "Ocurrió un problema. Vuelve a intentarlo.",
};

export class ApiError extends Error {
  constructor(readonly code: ApiErrorCode, readonly status?: number) {
    super(messages[code]);
    this.name = "ApiError";
  }
}
```

**src/lib/to-api-error.ts**

```ts
import axios from "axios";
import { ApiError } from "./api-error";

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!axios.isAxiosError(error)) return new ApiError("unknown");

  const status = error.response?.status;
  if (status === 401) return new ApiError("unauthorized", status);
  if (status === 404) return new ApiError("not_found", status);
  if (status === 422) return new ApiError("validation", status);
  if (error.response) return new ApiError("unknown", status);
  if (error.request) return new ApiError("network");
  return new ApiError("unknown");
}
```

El mensaje del servidor no se muestra tal cual. Puede nombrar tablas, rutas internas o detalles de implementación; puede estar en otro idioma; puede cambiar sin aviso y romper una prueba de interfaz. También puede estar influido por datos que el usuario envió, así que tratarlo como texto confiable para la pantalla es una mala idea. El cuerpo del error se registra para diagnóstico y se mapea a un mensaje propio orientado a la acción.

> [!tip]
> Un identificador de correlación en la respuesta permite que el usuario informe un problema y que el equipo encuentre el registro exacto. Es más útil que mostrar el `message` crudo, que suele ser ambiguo y a veces revela más de lo conveniente.

## Organizar las llamadas en capas

La separación que evita el desorden tiene tres piezas. `lib/axios.ts` configura el transporte: instancia, headers, interceptores y traducción de errores. `services/<dominio>.ts` expone funciones por dominio, con tipos de entrada y de salida, sin React. Los hooks de consulta conectan esas funciones con el componente y con la caché. El servicio no sabe que existe un componente: recibe parámetros, llama a la instancia y devuelve datos tipados, lo que permite probarlo sin renderizar nada y reutilizarlo desde un formulario, un loader o una tarea programada.

**src/services/campaigns.ts**

```ts
import { api } from "../lib/axios";
import { toApiError } from "../lib/to-api-error";
import type { Campaign } from "../types/campaign";

export type CampaignFilters = { q?: string; page?: number };

export async function listCampaigns(
  filters: CampaignFilters = {},
  signal?: AbortSignal,
): Promise<Campaign[]> {
  try {
    const { data } = await api.get<Campaign[]>("/campaigns", { params: filters, signal });
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}
```

El hook envuelve el servicio y le aporta la caché. La diferencia entre SWR y TanStack Query ya se explicó en otra parte de la serie; aquí solo importa el punto de unión: el fetcher llama al servicio, no a Axios.

**src/hooks/useCampaigns.ts**

```ts
import useSWR from "swr";
import { listCampaigns } from "../services/campaigns";
import type { ApiError } from "../lib/api-error";

export function useCampaigns(filters: { q?: string } = {}) {
  return useSWR<Awaited<ReturnType<typeof listCampaigns>>, ApiError>(
    ["campaigns", filters],
    () => listCampaigns(filters),
  );
}
```

Con TanStack Query el cambio es mínimo: `queryKey: ["campaigns", filters]` y `queryFn: () => listCampaigns(filters)`. La capa de transporte y la de servicios quedan igual; lo que cambia es la política de caché, revalidación e invalidación, no el lugar donde vive la llamada.

El componente consume el hook y no conoce ni la URL ni el token ni el formato del error de Axios. Si la consulta falla, recibe un `ApiError` con un mensaje que puede mostrar. Una mutación sigue el mismo camino: el servicio expone `createCampaign`, el hook la ejecuta y el componente solo dispara la acción.

## React Hook Form

React Hook Form es una librería de formularios para React. La línea estable es la 7; la versión verificada es `7.83.0`. Su propuesta central es no controlar cada campo con `useState`. Los inputs quedan sin controlar, el navegador conserva su valor y la librería se suscribe a los cambios mediante referencias. El componente se vuelve a renderizar por los errores y el estado del formulario, no por cada tecla de cada campo.

`useForm` devuelve, entre otras cosas, `register`, `handleSubmit` y `formState`. `register("name")` conecta el input con el formulario y devuelve las props que el campo necesita: `name`, `onChange`, `onBlur` y `ref`. `handleSubmit(onValid)` valida, evita el envío del navegador y llama a la función solo si no hay errores. `formState.errors` contiene un error por campo, con el mensaje que haya producido la validación. El `noValidate` del formulario desactiva la validación nativa para que los mensajes provengan del schema.

**src/features/campaigns/CampaignForm.tsx**

```tsx
import { useForm } from "react-hook-form";
import type { CampaignFormValues } from "./schema";

export function CampaignForm({ onSubmit }: { onSubmit: (values: CampaignFormValues) => Promise<void> }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CampaignFormValues>({
    defaultValues: { name: "", goal: 1000, months: 12 },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <label htmlFor="name">Nombre</label>
      <input id="name" {...register("name")} aria-invalid={errors.name ? "true" : undefined} />
      {errors.name && <p role="alert">{errors.name.message}</p>}

      <label htmlFor="goal">Objetivo</label>
      <input id="goal" type="number" {...register("goal", { valueAsNumber: true })} aria-invalid={errors.goal ? "true" : undefined} />
      {errors.goal && <p role="alert">{errors.goal.message}</p>}

      <label htmlFor="months">Plazo en meses</label>
      <input id="months" type="number" {...register("months", { valueAsNumber: true })} aria-invalid={errors.months ? "true" : undefined} />
      {errors.months && <p role="alert">{errors.months.message}</p>}

      <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Enviando..." : "Enviar"}</button>
    </form>
  );
}
```

Controlar cada campo con `useState` obliga a escribir un `onChange` por input, a mantener un objeto de errores, a marcar los campos tocados y a decidir cuándo validar. Además, cada tecla actualiza el estado del componente que contiene el formulario completo: en un formulario de diez campos, son diez estados que cambian y un render del contenedor por pulsación. La librería evita ese trabajo porque el valor vive en el DOM y solo se lee cuando hace falta.

> [!warning]
> El tag `latest` de npm apunta hoy a `8.0.0-beta.5`, un beta de la versión 8. No es una release estable verificable. Para instalar la línea que se describe en esta nota hay que fijar el major: `npm install react-hook-form@7`. Un `npm install react-hook-form` sin versión puede traer el beta y cambiar el comportamiento del formulario.

Hay casos donde un campo sí necesita control: un editor enriquecido, una máscara que transforma el valor al escribir o un componente de terceros sin referencia. Para eso existe `Controller`, que es la excepción y no la opción por defecto.

## Validación con esquemas

Un esquema declara la forma válida de los datos y produce mensajes por regla. La integración con React Hook Form se hace con `@hookform/resolvers@6.0.0`, que acepta `react-hook-form ^7.55.0`, `zod ^3.25.0 || ^4.0.0` y `yup ^1.0.0` como peers. El resolver conecta el resultado de la validación con `formState.errors` sin escribir validaciones a mano en el componente.

Zod 4 es la versión actual; la verificada es `zod@4.6.7`. Un schema completo declara cada campo, su mensaje y sus límites. `z.infer` extrae el tipo que devuelve el schema ya validado, de modo que el formulario y el servicio comparten una sola definición.

**src/features/campaigns/schema.ts**

```ts
import { z } from "zod";

export const campaignSchema = z.object({
  name: z.string().trim().min(3, "El nombre necesita al menos 3 caracteres").max(80, "El nombre no puede superar los 80 caracteres"),
  goal: z.number().positive("El objetivo debe ser mayor que cero").max(500_000_000, "El objetivo supera el máximo permitido"),
  months: z.number().int("Usa un número entero de meses").min(6, "El plazo mínimo es de 6 meses").max(36, "El plazo máximo es de 36 meses"),
});

export type CampaignFormValues = z.infer<typeof campaignSchema>;
```

Los campos numéricos usan `valueAsNumber`, así que el schema recibe números y `z.infer` describe exactamente el valor validado que consume el envío. Un campo vacío produce `NaN` y la validación lo rechaza. El formulario usa el resolver en lugar de las reglas sueltas de `register`.

**src/features/campaigns/useCampaignForm.ts**

```ts
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { campaignSchema, type CampaignFormValues } from "./schema";

export function useCampaignForm() {
  return useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: { name: "", goal: 1000, months: 12 },
  });
}
```

El resolver se importa desde `@hookform/resolvers/zod`. Con el resolver activo, `handleSubmit` ejecuta el schema y solo llama a la función de envío si los datos pasan. Los mensajes definidos en el schema llegan a `errors.<campo>.message`, y el componente no repite ninguna regla.

Yup es la alternativa. La versión verificada es `yup@1.7.1` y el resolver se importa desde `@hookform/resolvers/yup`. La forma del schema es `object().shape()`, con una cadena de reglas por campo.

**src/features/campaigns/schema.yup.ts**

```ts
import * as yup from "yup";

export const campaignSchema = yup.object().shape({
  name: yup.string().trim().min(3, "El nombre necesita al menos 3 caracteres").max(80, "El nombre no puede superar los 80 caracteres").required("El nombre es obligatorio"),
  goal: yup.number().typeError("El objetivo debe ser un número").positive("El objetivo debe ser mayor que cero").required("El objetivo es obligatorio"),
  months: yup.number().typeError("El plazo debe ser un número").integer("Usa un número entero de meses").min(6, "El plazo mínimo es de 6 meses").max(36, "El plazo máximo es de 36 meses").required("El plazo es obligatorio"),
});

export type CampaignFormValues = yup.InferType<typeof campaignSchema>;
```

La elección entre zod y yup no cambia la integración con el formulario: en ambos casos hay un resolver, un tipo inferido y mensajes por regla. Zod se acerca más a un tipo de TypeScript escrito a mano; yup conserva una API de validación encadenada que resulta familiar a quien viene de otros ecosistemas.

## Estilos

React no impone una solución de estilos. `className` es una prop como cualquier otra y el navegador aplica el CSS que coincida. Las tres formas que siguen cubren la mayoría de los casos: módulos con alcance local, variables para los tokens y `style` para lo que no se puede saber antes de renderizar.

### CSS Modules y SCSS

Un archivo `*.module.css` o `*.module.scss` produce un objeto donde cada clase declarada se transforma en un nombre único. El bundler genera ese nombre y el componente lo usa a través del objeto importado. Dos archivos pueden declarar `.card` sin colisionar, porque el nombre final incluye un hash por archivo.

**src/features/campaigns/CampaignCard.module.scss**

```scss
.card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.title {
  margin: 0;
  font-size: var(--font-size-lg);
}
```

**src/features/campaigns/CampaignCard.tsx**

```tsx
import styles from "./CampaignCard.module.scss";

export function CampaignCard({ name }: { name: string }) {
  return <article className={styles.card}><h2 className={styles.title}>{name}</h2></article>;
}
```

El alcance local resuelve el problema de nombres sin obligar a prefijos largos ni a convenciones globales. SCSS agrega anidamiento, variables de compilación y mixins, pero el alcance no viene de SCSS: viene de que el archivo sea un módulo de CSS. Sin la extensión `.module`, el mismo archivo sería global.

> [!note]
> react.dev no tiene una recomendación oficial sobre CSS Modules ni sobre variables CSS. Son prácticas extendidas del ecosistema, no un mandato de React. La documentación oficial describe `className` y `style`; no emite un veredicto sobre módulos ni sobre tokens.

### Variables CSS

Una variable CSS es un valor con nombre que se resuelve en el navegador. Se declara en un selector y se lee con `var()`. Si los tokens viven en `:root`, cualquier hoja puede consumirlos. Si el tema cambia un atributo en el elemento raíz, los mismos nombres toman otros valores y no hace falta reescribir las reglas.

**src/styles/tokens.css**

```css
:root {
  --color-bg: #ffffff;
  --color-surface: #f7f8fa;
  --color-text: #16181d;
  --color-text-muted: #5c6470;
  --color-border: #d8dce3;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --radius-md: 8px;
  --font-size-lg: 1.25rem;
}

[data-theme="dark"] {
  --color-bg: #111318;
  --color-surface: #1a1d24;
  --color-text: #f2f4f8;
  --color-text-muted: #a4adbd;
  --color-border: #2c313b;
}
```

El tema se cambia escribiendo `document.documentElement.dataset.theme = "dark"`, sin recorrer componentes ni recalcular estilos en JavaScript. Las variables también sirven para un valor que debe compartir varios archivos, como el espacio entre secciones o el radio de los bordes. La ventaja frente a una constante de SCSS es que la variable existe en tiempo de ejecución y puede cambiar con el tema.

### style en línea

La prop `style` acepta un objeto de JavaScript con nombres en camelCase: `backgroundColor`, `borderRadius`, `fontSize`. Los números reciben `px` de forma automática, salvo las propiedades sin unidad. `width: 240` equivale a `240px`; `lineHeight: 1.5`, `opacity: 0.6`, `zIndex: 2` y `flex: 1` se aplican tal cual, porque esas propiedades no usan píxeles.

**src/features/campaigns/ProgressBar.tsx**

```tsx
export function ProgressBar({ ratio }: { ratio: number }) {
  const clamped = Math.min(100, Math.max(0, ratio * 100));

  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress__fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}
```

El ancho depende de un dato que solo se conoce al renderizar. Ese es el caso legítimo de `style`. La documentación oficial lo dice con claridad: se recomienda usar `style` solo para estilos dinámicos cuyos valores no se conocen de antemano; en los demás casos, aplicar clases con `className` es más eficiente.

La razón es doble: un objeto literal en el JSX se crea en cada render y participa de la comparación de props, y `style` no puede expresar `:hover`, `:focus`, media queries ni pseudoelementos, así que mezclar estilos estáticos ahí obliga a resolver en JavaScript lo que el CSS ya resuelve mejor. La regla práctica es simple: si el valor se puede escribir en CSS, va en CSS; si depende de una medición, un dato de la API o una preferencia del usuario, va en `style`.
## Arquitectura y React 19

## Arquitectura para diseñar aplicaciones React

La estructura de carpetas no es la arquitectura. Un árbol idéntico puede esconder dos sistemas opuestos: en uno, el módulo de pagos conoce el de catálogo y nadie lo nota; en el otro, esa dependencia está prohibida y una herramienta la detecta antes de integrar. La carpeta es una consecuencia; la arquitectura es el conjunto de decisiones costosas de revertir.

Estas son las decisiones que sí son arquitectura:

- **Límites.** Qué módulos existen y qué responsabilidad tiene cada uno. Un límite claro permite cambiar una parte sin leer el resto.
- **Dependencias permitidas.** Qué puede importar qué. Sin esta regla, los límites son una convención oral que se rompe en el primer contratiempo.
- **Dirección de los imports.** Si el flujo va siempre del borde hacia el núcleo, el núcleo no necesita conocer la interfaz ni la red.
- **Contratos.** Qué forma tiene lo que un módulo expone y qué oculta. Un `index.ts` que publica tres funciones es un contrato; exponer todo el directorio no lo es.
- **Ubicación de los efectos.** Dónde se habla con la API, dónde se escribe en el almacenamiento y qué capa tiene permiso para hacerlo.

El árbol de carpetas se deriva de esas decisiones, no al revés. Si un equipo discute durante una hora si un archivo va en `components` o en `features` sin haber definido qué puede importar cada módulo, está discutiendo estética de directorios. La prueba es simple: cambie el árbol y vea si las reglas de dependencia siguen siendo verificables. Si la respuesta es no, lo que había era un dibujo.

> [!note]
> Una arquitectura que solo vive en un documento no existe. El límite se sostiene con una regla ejecutable: una restricción de lint, un analizador de dependencias o una prueba que falla cuando aparece un import prohibido.

## Screaming Architecture

La idea central se enuncia sin rodeos: «la arquitectura debería gritar el caso de uso que atiende, no el framework con el que está construida». Al abrir el proyecto, lo primero que se lee debería ser el negocio: pedidos, catálogo, facturación, identidad. Si lo primero que se lee es `components`, `hooks`, `utils` y `services`, la estructura describe la herramienta y no el producto.

Un árbol que grita el dominio, para un marketplace, se parece a esto:

**src/**
```text
src/
├── app/
│   ├── router.tsx
│   └── providers.tsx
├── catalog/
│   ├── api/
│   ├── model/
│   ├── ui/
│   └── index.ts
├── orders/
│   ├── api/
│   ├── model/
│   ├── ui/
│   └── index.ts
├── billing/
│   ├── api/
│   ├── model/
│   ├── ui/
│   └── index.ts
└── shared/
    ├── ui/
    └── lib/
```

Cada carpeta de primer nivel es una capacidad del producto, no un tipo de archivo. Dentro, `api/` concentra las llamadas remotas, `model/` las reglas y los tipos, `ui/` los componentes y `index.ts` la superficie pública. `app/` solo compone: monta el router y los providers, y no contiene lógica de negocio.

La regla que hace que el árbol signifique algo es la dirección de los imports. `orders` puede importar `catalog/index.ts` y `shared/lib`, pero `catalog` nunca importa `orders`, y ninguna capacidad importa desde `app/`. Cuando dos capacidades necesitan hablarse, la relación se declara en una sola dirección o se resuelve con un evento; si se permiten las dos, los límites desaparecieron.

`shared/` es la válvula de escape y también el riesgo. Un botón genérico pertenece ahí; una función que solo usa `billing` no. Cada cosa que se mueve a `shared/` deja de tener dueño y empieza a crecer sin control. La prueba para aceptarla es que al menos dos capacidades la usen y que su contrato sea estable.

## Clean Architecture

Clean Architecture ordena el sistema en capas y fija una regla: las dependencias apuntan hacia adentro. El centro contiene las entidades y las reglas que no dependen de nada; hacia afuera aparecen los casos de uso, los adaptadores y, en el borde, los frameworks.

| Capa | Responsabilidad | Ejemplo en una aplicación React |
| --- | --- | --- |
| Entidades | Reglas que valen aunque no exista interfaz | Un pedido no puede pagarse dos veces |
| Casos de uso | Orquestan entidades y puertos | `ConfirmOrder`, `LoadCampaign` |
| Adaptadores | Traducen entre el mundo exterior y los casos de uso | Componentes, hooks de datos, repositorios HTTP |
| Frameworks | Detalles reemplazables | React, el router, el cliente HTTP |

React vive en el borde, como adaptador de entrada. Un componente no debería contener la regla que decide si un pedido es pagable: recibe datos, dispara un caso de uso y muestra el resultado. Los casos de uso se escriben como funciones o clases sin importar React, lo que permite probarlos sin montar un componente y sin simular el DOM.

La regla de dependencia tiene una consecuencia práctica: el núcleo no importa `react`, ni el router, ni el cliente de la API. Si una regla de negocio necesita saber si un botón está deshabilitado, la regla está en el lugar equivocado.

**casos-de-uso/confirm-order.ts**
```ts
import type { OrderRepository } from '../puertos/order-repository';

export async function confirmOrder(
  repository: OrderRepository,
  orderId: string,
): Promise<{ ok: true } | { ok: false; reason: 'already-paid' }> {
  const order = await repository.findById(orderId);
  if (!order) throw new Error('Pedido inexistente');
  if (order.status === 'paid') return { ok: false, reason: 'already-paid' };
  await repository.markAsPaid(orderId);
  return { ok: true };
}
```

El componente que confirma un pedido solo traduce el clic en una llamada y el resultado en interfaz. El repositorio es un puerto; la implementación con `fetch` vive en infraestructura y se inyecta. Cambiar la API por otro transporte no toca el caso de uso.

Lo que se gana es testeabilidad del núcleo, independencia de la infraestructura y contratos explícitos. Lo que se paga es indirección: cada operación atraviesa varias capas, cada frontera necesita tipos de traducción y el número de archivos crece. En un proyecto de cinco pantallas y un solo equipo, imponer las cuatro capas completas suele costar más de lo que aporta: se escriben mapeos entre modelos que son idénticos y se navega por tres archivos para encontrar una suma.

La versión honesta para un proyecto chico es conservar la regla y descartar la ceremonia. Separe las reglas de negocio de los componentes, haga que las dependencias apunten en una sola dirección y deje las capas formales para cuando el dominio tenga suficiente superficie. Lo que no conviene es llamar «Clean Architecture» a tener carpetas con esos nombres y un único archivo dentro de cada una.

## Container y presentational

El patrón dividía cada pantalla en dos componentes: uno container que obtenía datos y manejaba el estado, y uno presentacional que recibía props y solo renderizaba. La división se popularizó como doctrina de carpetas: `containers/` por un lado, `components/` por el otro.

Su autor, Dan Abramov, desautorizó esa lectura en la actualización de 2019 de su artículo sobre el tema:

> «I don't suggest splitting your components like this anymore. If you find it natural in your codebase, this pattern can be handy. But I've seen it enforced without any necessity and with almost dogmatic fervor far too many times… Hooks let me do the same thing without an arbitrary division.»

Lo que sobrevive es la inquietud de fondo: separar la obtención de datos de la presentación. Lo que no sobrevive es la división en dos componentes y dos carpetas como regla del proyecto. Un hook propio cumple la misma función sin agregar un nivel al árbol ni inventar una frontera donde el código no la pedía.

**use-campaign.ts**
```ts
import { useEffect, useState } from 'react';
import { fetchCampaign, type Campaign } from '../api/campaigns';

export function useCampaign(id: string) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCampaign(id)
      .then((data) => {
        if (!cancelled) setCampaign(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause : new Error('Error de carga'));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { campaign, error };
}
```

**campaign-view.tsx**
```tsx
import { useCampaign } from './use-campaign';

export function CampaignView({ id }: { id: string }) {
  const { campaign, error } = useCampaign(id);
  if (error) return <p role="alert">No se pudo cargar la campaña.</p>;
  if (!campaign) return <p>Cargando…</p>;
  return <h2>{campaign.name}</h2>;
}
```

`CampaignView` sigue siendo presentacional en el sentido útil: no sabe cómo se obtienen los datos. El hook es el container, pero no es un componente ni vive en una carpeta aparte. Si mañana la pantalla necesita dos hooks, se combinan; si otra pantalla necesita los mismos datos, se reutiliza el hook.

> [!warning]
> El patrón container/presentational está desautorizado por su propio autor y no debe presentarse como recomendación vigente. Citarlo como buena práctica actual es un error de fecha, no una preferencia de estilo. Si se encuentra en un código existente, se reconoce y se respeta; no se propone como norma para código nuevo.

## Portals

`createPortal(children, domNode, key?)` está en `react-dom`. Renderiza el contenido en otro nodo del documento sin moverlo en el árbol de React. El componente sigue siendo hijo del mismo padre lógico: recibe su contexto, sus props y sus actualizaciones como cualquier otro.

El portal cambia una sola cosa: la ubicación en el DOM. Los eventos burbujean según el árbol de React, no según el árbol del DOM. Un clic dentro de un modal montado en `document.body` llega al `onClick` del componente que lo declara, aunque en el documento no exista ninguna relación de ancestro. El contexto también sigue fluyendo desde el padre de React, no desde el nodo contenedor.

Se usa cuando un elemento necesita escapar de un límite visual: modales, menús flotantes, tooltips, notificaciones y cualquier capa que sufra `overflow: hidden`, `transform` o un `z-index` atrapado en un contexto de apilamiento.

**modal.tsx**
```tsx
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({ open, title, onClose, children }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
        <button type="button" onClick={onClose}>Cerrar</button>
      </div>
    </div>,
    document.body,
  );
}
```

El ejemplo mueve el foco al diálogo, lo devuelve al elemento anterior al cerrar y cierra con Escape. No incluye una trampa de foco completa: un modal accesible necesita además que el tabulador no escape del diálogo, o bien usar el elemento nativo `<dialog>`. El portal no resuelve accesibilidad por sí solo; solo resuelve dónde se dibuja el nodo.

> [!warning]
> Un portal no mueve el foco ni cambia el orden de tabulación. El foco inicial, el ciclo del tabulador y la devolución del foco al cerrar se implementan a mano o se delegan en un componente que los resuelva.

## Higher order components

Un higher order component es una función que recibe un componente y devuelve otro componente con comportamiento agregado. Se escribía `withAuth(Page)`, `withLoading(Component)` o `connect(mapState)(Component)`, y se usaba para inyectar props, proteger rutas, registrar métricas o suscribirse a un store.

Hoy son legado. `react.dev` no los enseña: el recorrido oficial presenta los hooks propios como la forma de reutilizar lógica con estado. La documentación histórica lo dice sin rodeos: «Higher-order components are not commonly used in modern React code». El motivo no es estético. Un HOC agrega un nivel de anidación por cada comportamiento, puede colisionar nombres de props, complica los tipos y obliga a reenviar `ref` con `forwardRef`, que a su vez arrastra su propia deprecación anunciada.

Lo que los reemplazó es el hook propio. La lógica se extrae a una función que empieza con `use`, el componente la invoca y conserva el control sobre el árbol, los tipos y el orden de las props. El HOC sigue apareciendo en código antiguo y en bibliotecas, así que conviene reconocerlo aunque no se escriba.

**with-auth.tsx**
```tsx
import type { ComponentType } from 'react';
import { useSession } from './session';

export function withAuth<P extends object>(Component: ComponentType<P>) {
  return function Authenticated(props: P) {
    const session = useSession();
    if (!session) return <p>Inicie sesión para continuar.</p>;
    return <Component {...props} />;
  };
}
```

La versión con hook es una línea en el componente: `const session = useSession()`. No hay envoltorio, no hay props inyectadas y el flujo se lee de arriba abajo. La regla práctica es no crear HOC nuevos; si uno existente estorba, se migra cuando se toque ese código, no en una migración aparte.

## Suspense y lazy

`lazy(load)` carga el código de un componente la primera vez que se renderiza. `Suspense` muestra un fallback mientras ese subárbol no está listo. Juntos resuelven la división de código: la pantalla principal no arrastra el editor, el panel de administración ni una vista que casi nadie abre.

`lazy` tiene tres condiciones. Recibe una función que devuelve una `Promise` de módulo y el módulo debe tener una exportación `default`; si el componente se exporta con nombre, se envuelve antes de pasarlo. La llamada se declara en el nivel superior del módulo, no dentro de un componente ni de una condición, porque el tipo de componente debe ser estable entre renders. Si la `Promise` se rechaza, el error llega al Error Boundary más cercano, no al `Suspense`.

**routes.tsx**
```tsx
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from './error-boundary';

const ReportsPage = lazy(() => import('./reports-page'));

export function ReportsRoute() {
  return (
    <ErrorBoundary fallback={(error) => <p role="alert">{error.message}</p>}>
      <Suspense fallback={<p>Cargando informes…</p>}>
        <ReportsPage />
      </Suspense>
    </ErrorBoundary>
  );
}
```

Lo que `Suspense` no hace es detectar datos. No ve una `Promise` lanzada dentro de un `useEffect` ni una petición iniciada en un event handler; esos casos no suspenden el árbol y el fallback nunca aparece. Para que un componente suspenda, la lectura tiene que ocurrir durante el render y a través de una fuente que Suspense entienda, como `lazy` o `use` con una `Promise` cacheada.

Tampoco conserva el estado si el primer montaje suspende: React descarta ese árbol y lo vuelve a montar cuando el contenido está listo. Y si un componente ya montado vuelve a suspender, el fallback reaparece y la interfaz parpadea, salvo que la actualización ocurra dentro de una Transition o el valor se lea con `useDeferredValue`. Esa diferencia explica por qué una búsqueda que suspende en cada tecla se siente peor que una que no suspende.

## ErrorBoundary

Un Error Boundary captura errores lanzados durante el render, en el ciclo de vida y en los constructores del subárbol. No captura errores de event handlers, de código asíncrono fuera del render ni los que lanza el boundary mismo.

Sigue siendo solo de clase. No existe un hook equivalente: `getDerivedStateFromError` decide el estado de respaldo y `componentDidCatch` registra el error. La documentación sugiere el paquete `react-error-boundary` para no reescribir la clase en cada proyecto.

**error-boundary.tsx**
```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  fallback: (error: Error, reset: () => void) => ReactNode;
  children: ReactNode;
};

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error capturado por el boundary', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) return this.props.fallback(this.state.error, this.reset);
    return this.props.children;
  }
}
```

`getDerivedStateFromError` es estático porque React lo llama durante el render, antes de aplicar el estado; su valor devuelto reemplaza el estado y provoca el render de respaldo. `componentDidCatch` corre después, cuando el árbol ya se resolvió, y es el lugar para registrar el error con su rastro de componentes.

En React 19 los errores de render ya no se vuelven a lanzar. Si nadie los captura, terminan en `window.reportError`; si un boundary los captura, se registran con `console.error`. La raíz acepta dos opciones nuevas, `onCaughtError` y `onUncaughtError`, para centralizar ese registro sin depender de la consola.

**main.tsx**
```tsx
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { reportToService } from './telemetry';

createRoot(document.getElementById('root')!, {
  onCaughtError: (error) => reportToService(error),
  onUncaughtError: (error) => reportToService(error),
}).render(<App />);
```

> [!tip]
> Coloque un boundary por región importante —layout, lista, panel— y no uno solo en la raíz. Un boundary global convierte cualquier fallo en una pantalla en blanco; varios permiten que el resto de la aplicación siga funcionando.

## React 19 no es experimental

React 19 es estable desde el 5 de diciembre de 2024. La versión actual es 19.3.1; la 19.3.0 se publicó el 9 de septiembre de 2026. No existe React 20.

La idea de que React 19 era «experimental» quedó vieja por la fecha: la versión estable existe desde diciembre de 2024 y es la recomendada. El canal `canary` sigue existiendo para probar funciones no publicadas, pero no es la vía de actualización de una aplicación.

> [!warning]
> Dos afirmaciones deben considerarse obsoletas. «No usar React 19 en aplicaciones en entorno real» es falso desde diciembre de 2024: la versión estable es la recomendada. Y `npm update react@canary` no es un paso de actualización: instala un canal de desarrollo pensado para probar cambios no publicados, no para reemplazar la versión estable.
>
> Una actualización se hace con la versión publicada y con una batería de pruebas que corra en el mismo entorno que la aplicación.

## Actualizar a React 19

La actualización se hace con versiones exactas y con los tipos alineados. Los comandos que indican los documentos son:

**package.json**
```bash
npm install --save-exact react@^19.0.0 react-dom@^19.0.0
npm install --save-exact --save-dev @types/react@^19.0.0 @types/react-dom@^19.0.0
npx codemod@latest react/19/migration-recipe
```

El codemod automatiza parte de la migración mecánica. No reemplaza la lectura del changelog ni las pruebas: los cambios de comportamiento —errores que ya no se relanzan, `ref` como prop, reseteo de formularios— no se detectan mirando el código.

El transform JSX nuevo es obligatorio. React 19 dejó de admitir el transform clásico, así que la compilación tiene que usar `react/jsx-runtime`; sin eso, el código no compila. Es un cambio de configuración del compilador o del bundler, no una decisión opcional por proyecto.

> [!note]
> Actualice React y React DOM juntos y con la misma versión. Mezclar versiones produce errores difíciles de leer, porque el renderer y el núcleo comparten contratos internos que no son públicos.

## Componentes de servidor y Actions

Conviene separar dos mitades que suelen presentarse como una sola. Los componentes de servidor y las Server Functions (`"use server"`) requieren una integración de framework o de bundler; las APIs de bundler para RSC no siguen semver y no se consumen directamente desde una aplicación cliente. Next.js App Router es la implementación más completa de esa mitad.

La otra mitad funciona en una aplicación cliente normal, creada con Vite y sin servidor de React: Actions, `<form action>`, `useActionState`, `useFormStatus`, `useOptimistic` y `use` viven en `react` y `react-dom`. No necesitan RSC ni un framework.

| Pieza | Dónde funciona | Requisito |
| --- | --- | --- |
| Componentes de servidor, `"use server"` | En el servidor, dentro de un árbol RSC | Integración de framework o bundler |
| Actions y `<form action>` | Cliente, o servidor con RSC | `react` |
| `useActionState`, `useFormStatus`, `useOptimistic` | Cliente, sin framework | `react` y `react-dom` |
| `use` con una `Promise` cacheada | Cliente, sin framework | `react` |

La consecuencia práctica es que un equipo con una SPA puede adoptar Actions y formularios sin migrar a un framework. Lo que no puede hacer es escribir un componente de servidor y esperar que el bundler lo entienda: esa mitad sigue atada a una integración que decide cómo se serializa el árbol y dónde corre cada pieza.

## Actions y formularios

Una Action es una función que se pasa a `<form action={fn}>`. React envuelve el envío en una Transition, entrega la `FormData` del formulario y, si la acción termina con éxito, resetea el formulario. Ese reseteo es la razón por la que los campos no controlados vuelven a vacío sin que nadie limpie el estado a mano.

`useActionState(reducerAction, initialState, permalink?)` devuelve `[state, dispatchAction, isPending]`. El reducer puede ser asíncrono y recibe el estado anterior junto con la `FormData`; las llamadas que se disparan mientras una acción está en curso se encolan y se ejecutan en orden. El tercer argumento opcional, `permalink`, indica la URL del formulario para el envío cuando JavaScript todavía no está disponible.

**subscribe-form.tsx**
```tsx
import { useActionState } from 'react';
import { subscribe } from './actions';
import { SubmitButton } from './submit-button';

export function SubscribeForm() {
  const [message, formAction, isPending] = useActionState(subscribe, null);

  return (
    <form action={formAction} aria-busy={isPending}>
      <label htmlFor="email">Correo electrónico</label>
      <input id="email" name="email" type="email" required />
      <SubmitButton>Suscribirme</SubmitButton>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
```

**submit-button.tsx**
```tsx
import { useFormStatus } from 'react-dom';

export function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Enviando…' : children}
    </button>
  );
}
```

`useFormStatus()` se importa de `react-dom`, no de `react`, y se llama desde un componente que está dentro del `<form>`. Devuelve `{ pending, data, method, action }`. Llamarlo en el mismo componente que declara el `<form>` no observa ese formulario: el hook lee el contexto del formulario padre, así que debe vivir en un hijo.

**actions.ts**
```ts
export async function subscribe(_previous: string | null, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!email.includes('@')) return 'Ingrese un correo válido.';
  const response = await fetch('/api/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ email }),
    headers: { 'Content-Type': 'application/json' },
  });
  return response.ok ? 'Suscripción confirmada.' : 'No se pudo completar la suscripción.';
}
```

El formulario no necesita `onSubmit` ni `preventDefault`. El estado de la acción es el mensaje; `isPending` deshabilita el botón sin un `useState` adicional. El reseteo ocurre solo cuando la acción termina sin lanzar; una acción que lanza conserva lo cargado.

## useOptimistic

`useOptimistic(value, reducer?)` devuelve `[optimisticState, setOptimistic]`. Muestra el resultado de una acción antes de que el servidor confirme. El setter debe llamarse dentro de una Action o de un `startTransition`; fuera de ese contexto React no puede asociar el cambio optimista a la operación que lo originó. Al terminar la acción, el estado optimista se descarta y vuelve a mandar el valor real.

**thread.tsx**
```tsx
import { useOptimistic, useRef } from 'react';

type Message = { id: string; text: string; sending?: boolean };

type ThreadProps = {
  messages: Message[];
  send: (text: string) => Promise<void>;
};

export function Thread({ messages, send }: ThreadProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (current: Message[], text: string) => [
      ...current,
      { id: `temp-${current.length}`, text, sending: true },
    ],
  );

  async function sendMessage(formData: FormData) {
    const text = String(formData.get('text') ?? '').trim();
    if (!text) return;
    addOptimisticMessage(text);
    formRef.current?.reset();
    await send(text);
  }

  return (
    <>
      <ul>
        {optimisticMessages.map((message) => (
          <li key={message.id} aria-busy={message.sending}>
            {message.text}
          </li>
        ))}
      </ul>
      <form ref={formRef} action={sendMessage}>
        <label htmlFor="text">Mensaje</label>
        <input id="text" name="text" autoComplete="off" />
        <button type="submit">Enviar</button>
      </form>
    </>
  );
}
```

El mensaje aparece de inmediato con un identificador temporal. Cuando `send` termina, el estado real —con el identificador definitivo— reemplaza al optimista. Si la acción falla, el mensaje temporal desaparece sin que haya que revertir nada a mano.

> [!warning]
> El estado optimista es de corta vida y no es una caché. Si el setter se llama fuera de una Action o de `startTransition`, el cambio se pierde o se aplica en un momento inesperado. Y si la operación falla, la interfaz vuelve al estado real: no hay reconciliación automática de errores.

## use

`use` lee una Promise o un Context durante el render. No es un hook: no sigue sus reglas de llamada. Puede invocarse dentro de un `if` y dentro de un loop, porque React no necesita un orden estable de hooks para resolverlo.

La contraparte es que no puede llamarse dentro de `try/catch`. La suspensión no es una excepción que se pueda atrapar en el componente: si la `Promise` rechaza, el error sube al Error Boundary más cercano. Para manejar el fallo, se envuelve la región con un boundary, no con `try`.

Las `Promise` deben estar cacheadas entre renders. Si cada render crea una `Promise` nueva, React no puede reutilizar el resultado y avisa con «A component was suspended by an uncached promise». La caché puede ser un módulo, un store o un framework de datos; lo que no sirve es `fetch` dentro del cuerpo de un componente.

**user-name.tsx**
```tsx
import { use, Suspense } from 'react';
import { getUserPromise } from './user-cache';

function UserName({ id }: { id: string }) {
  const user = use(getUserPromise(id));
  return <span>{user.name}</span>;
}

export function UserBadge({ id }: { id: string }) {
  return (
    <Suspense fallback={<span>Cargando…</span>}>
      <UserName id={id} />
    </Suspense>
  );
}
```

`user-cache` devuelve la misma `Promise` para el mismo `id` mientras siga pendiente o mientras el resultado siga vigente. Esa es la parte que hace que `use` funcione: la identidad de la `Promise` es la identidad de la lectura.

Un contexto también se lee con `use(CampaignContext)`, con la diferencia de que el contexto sí es un valor estable y no suspende. En React 19.3, `use(browser())` permite optar por no renderizar un valor en el servidor; el valor solo existe en el navegador.

## ref como prop y Context como provider

React 19 permite recibir `ref` como una prop normal en un componente de función. Ya no hace falta envolver con `forwardRef` para que un padre acceda al nodo. `forwardRef` sigue funcionando y tiene anunciada su deprecación, así que el código existente no se rompe, pero el código nuevo se escribe sin él.

**field.tsx**
```tsx
import type { Ref } from 'react';

type FieldProps = {
  label: string;
  ref?: Ref<HTMLInputElement>;
};

export function Field({ label, ref }: FieldProps) {
  return (
    <label>
      {label}
      <input ref={ref} />
    </label>
  );
}
```

El padre usa `<Field label="Buscar" ref={inputRef} />` sin ceremonia. El tipo `Ref` admite tanto un objeto como una función, y la prop se comporta como cualquier otra: se puede reenviar, combinar o ignorar.

Para Context, la forma nueva es `<Context value={...}>`. `createContext` sigue siendo el mismo; lo que cambia es el componente que publica el valor. `<Context.Provider>` continúa funcionando como API legacy y tiene anunciada una deprecación futura, no una remoción.

**theme-provider.tsx**
```tsx
import { useMemo, useState, type ReactNode } from 'react';
import { ThemeContext, type Theme } from './theme-context';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return (
    <ThemeContext value={value}>
      {children}
    </ThemeContext>
  );
}
```

> [!note]
> `ref` como prop no elimina la necesidad de `forwardRef` en bibliotecas que todavía declaran sus tipos con él. La compatibilidad se mantiene; la diferencia es que ya no es el único camino.

## Metadatos, estilos y precarga

React 19 eleva al `<head>` los elementos `<title>`, `<meta>` y `<link>` que se renderizan en cualquier componente. Funciona también en el cliente: no hace falta un framework ni una API de servidor. Un componente de detalle puede declarar su propio título sin que el layout sepa que existe.

**article-meta.tsx**
```tsx
export function ArticleMeta({ title }: { title: string }) {
  return (
    <>
      <title>{title}</title>
      <meta name="description" content="Detalle del artículo" />
      <link rel="stylesheet" href="/article.css" precedence="default" />
    </>
  );
}
```

`<link rel="stylesheet" precedence="...">` y `<style precedence="...">` ordenan por precedencia; las hojas se deduplican por `href` y los estilos por contenido. Dos componentes que piden la misma hoja no generan dos etiquetas, y el orden entre hojas queda definido por la precedencia en lugar del orden de montaje.

`react-dom` expone cuatro funciones para anticipar recursos: `preinit(url, { as })` inicializa y descarga, `preload(url, { as })` descarga sin ejecutar, `prefetchDNS(url)` resuelve el DNS y `preconnect(url)` abre la conexión. Se llaman antes de que el recurso haga falta.

**assets.ts**
```ts
import { preconnect, preinit, preload } from 'react-dom';

preconnect('https://cdn.example.com');
preload('/fonts/inter.woff2', { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
preinit('https://cdn.example.com/theme.css', { as: 'style' });
```

El callback de `ref` puede devolver una función de limpieza, igual que un efecto. Devolver cualquier otra cosa es un error de tipos.

**cursor-tracker.tsx**
```tsx
export function CursorTracker() {
  return (
    <div
      ref={(node) => {
        const onMove = (event: PointerEvent) => {
          node.dataset.x = String(event.clientX);
        };
        node.addEventListener('pointermove', onMove);
        return () => node.removeEventListener('pointermove', onMove);
      }}
    />
  );
}
```

`useDeferredValue(value, initialValue)` acepta un segundo argumento con el valor que se usa en el primer render. Sin él, el primer render devuelve el valor actual; con él, se puede mostrar una versión liviana mientras llega el valor definitivo, sin un estado adicional.

## Lo que React 19 eliminó

**Removidos**

| API | Estado | Reemplazo |
| --- | --- | --- |
| `propTypes` | Removido | Tipos de TypeScript |
| `defaultProps` en funciones | Removido | Parámetros por defecto |
| Context legacy (`contextTypes`, `getChildContext`) | Removido | `createContext` |
| String refs | Removido | `ref` como prop o callback |
| `React.createFactory` y factories del patrón módulo | Removido | JSX |
| `react-test-renderer/shallow` | Removido | Pruebas de comportamiento |
| `react-dom/test-utils` | Removido, salvo `act` | `act` se importa de `react` |
| `ReactDOM.render` | Removido | `createRoot` |
| `ReactDOM.hydrate` | Removido | `hydrateRoot` |
| `unmountComponentAtNode` | Removido | `root.unmount()` |
| `ReactDOM.findDOMNode` | Removido | `ref` al nodo |
| Builds UMD | Removidos | Módulos ES o el bundler |

**Deprecados**

| API | Estado | Reemplazo |
| --- | --- | --- |
| `element.ref` | Deprecado | `element.props.ref` |
| `react-test-renderer` | Deprecado | Biblioteca de pruebas de comportamiento |
| `ReactDOM.useFormState` | Renombrado | `useActionState` |

La diferencia entre removido y deprecado no es burocrática. Un removido rompe la compilación o el runtime; un deprecado sigue funcionando y anuncia que va a cambiar. `element.ref` es el caso típico: la prop sigue existiendo, pero la lectura desde `element.ref` deja de ser la vía correcta y se migra a `element.props.ref`.

## Novedades de React 19.3

- `<ViewTransition>` integra animaciones de transición en el árbol de React.
- `addTransitionType` etiqueta una transición para distinguir su origen.
- `<Fragment ref>` expone un `FragmentInstance` cuando se necesita una referencia al fragmento.
- `browser()` permite optar por no renderizar un valor en el servidor.
- Se agrega soporte de Trusted Types para las políticas de seguridad de contenido.
- Los componentes de servidor pueden leer contexto directamente.

## React Compiler en una frase

React Compiler 1.0 es estable desde el 7 de octubre de 2025, es opcional y cambia cuánta memoización manual hace falta; la mecánica de hooks y memoización está en la parte 2.

## Cierre

React no se aprende memorizando hooks: se aprende entendiendo qué es el estado, quién lo posee y cuándo cambia. Las herramientas del ecosistema cambian de versión todos los años —SWR pasó a la 2, Zustand a la 5, Jotai a la 3, React Router ya va por la 8— pero el criterio para elegir se mantiene estable: usá el estado más cercano que resuelva el problema, subí de nivel solo cuando la distancia lo justifique, y dejá el estado de servidor en manos de una librería de consultas en lugar de reinventarlo.

## Autoría

Pensado por Ariel Duarte. Redactado y mejorado con AI.
