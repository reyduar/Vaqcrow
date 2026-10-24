---
title: React, la biblioteca de interfaz y su ecosistema
type: tecnologia
sources:
  - blog/react-essentials.md
updated: 2026-10-23
---

## Qué es React

React es una biblioteca para construir interfaces, no un framework completo. Resuelve una sola cosa: describir la interfaz como una función del estado, y encargarse de actualizar el DOM cuando ese estado cambia.

Esa libertad es su ventaja y su riesgo. Permite prototipar rápido y cambiar de rumbo sin pelear con la herramienta, pero deja sin resolver el enrutamiento, los datos, los formularios y la estructura del proyecto. Esas decisiones se eligen aparte.

## Cómo actualiza la interfaz

Cuando el estado cambia, React vuelve a ejecutar el componente y produce un árbol nuevo. Después compara ese árbol con el anterior y aplica al DOM sólo las diferencias.

El "virtual DOM" describe bien la idea, pero no explica por sí solo el rendimiento. Si una pantalla es lenta, el problema suele estar en el trabajo que ocurre durante el render o en la cantidad de renders, no en la existencia del árbol intermedio.

En las listas, la prop `key` identifica cada elemento entre renders. Usar el índice del array como `key` rompe esa identificación cuando la lista se reordena, se filtra o crece por delante.

## Los hooks

Los hooks permiten usar estado y otras capacidades de React desde componentes de función. Se llaman siempre en el nivel superior del componente, nunca dentro de una condición o de un bucle.

Cada hook resuelve un problema distinto:

- `useState`: un valor que cambia y obliga a re-renderizar.
- `useEffect`: sincronizar con un sistema externo. No es el lugar para calcular estado derivado ni para pedir datos con una librería de consultas.
- `useContext`: leer un valor del provider más cercano.
- `useReducer`: lógica de actualización con acciones, cuando el estado tiene varias transiciones.
- `useRef`: un valor mutable que no dispara renders, o la referencia a un nodo del DOM.
- `useMemo` y `useCallback`: guardar un valor o una función entre renders. Son optimizaciones, no reglas de diseño.

Un hook propio comparte lógica con estado, no el estado en sí.

## Dónde vive el estado

La clasificación que ordena las decisiones:

- Estado local: lo usa un solo componente.
- Estado global: lo comparten varios componentes de la aplicación.
- Estado derivado: se calcula a partir de otro estado y no se guarda.
- Estado de servidor: lo que llega de una API, con su caché y su revalidación.
- Estado de interfaz: si un modal está abierto, qué pestaña está activa.

La regla práctica es usar el estado más cercano que resuelva el problema. Se sube de nivel cuando la distancia entre quien lo produce y quien lo consume lo justifica.

Para el estado global existen varias herramientas, y la elección depende del problema: Context API para valores que cambian poco, Redux Toolkit para una aplicación que ya lo usa, RTK Query, TanStack Query o SWR para estado de servidor, Zustand para estado de módulo simple y Jotai para átomos que se combinan.

Un detalle importante: en Zustand el patrón recomendado en aplicaciones con render del lado del servidor crea una store por montaje mediante un provider, no un singleton de módulo.

## Enrutamiento

React no trae router. La opción más difundida es React Router, que hoy va por su versión 8 y ofrece tres modos: declarativo, data y framework.

Dos APIs desaparecieron y siguen apareciendo en material viejo: `Switch` fue reemplazado por `Routes` en la versión 6, y `activeClassName` se reemplazó por una función en `className` que recibe `isActive`.

## React 19

React 19 es estable desde diciembre de 2024. La versión actual de la línea es la 19.3.

Los cambios que más afectan al código existente:

- Las validaciones de `propTypes` se ignoran y `defaultProps` ya no funciona en componentes de función. La vía para tipar props es TypeScript.
- El namespace global `JSX` desapareció de los tipos: se escribe `React.JSX.Element`, y para `children` se usa `React.ReactNode`.
- `ref` es una prop normal de los componentes de función, así que `forwardRef` deja de ser necesario.
- Un contexto se puede renderizar directamente como provider: `<Context value={...}>`.
- Las Actions y los formularios con `<form action={...}>` funcionan en una aplicación de cliente. Sólo los componentes de servidor y las Server Functions requieren un framework.
- React Compiler, estable desde octubre de 2025, reduce la necesidad de memoizar a mano.

## Versiones que documenta la guía

Las versiones citadas en la guía de origen, verificadas contra la documentación oficial: React 19.3, React Router 8, Redux 5 y Redux Toolkit 2, TanStack Query 5, SWR 2, Zustand 5, Jotai 3, React Hook Form 7, zod 4, yup 1 y Axios 1.
