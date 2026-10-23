# React Essentials: blog y wiki

Objetivo: modernizar `docs/guides/blog/react-essentials.md`, dotarlo de índice y estructura Obsidian, y publicarlo como artículo del blog y como página de la wiki del asistente.
Rama: `Vaqcrow#617_Feat_Modernize_React_Essentials_and_publish_it_to_blog_and_wiki` · Issue: #617 · Runner: `pnpm run verify` (+ `pnpm run test:db` para la seed).

## Specs

- **S1 — Modernizar el contenido.** Requisito textual: «quiero que lo modernices». Alcance: actualizar lo que quedó obsoleto respecto a 2026 (React 19, React Router v7, Redux 5/RTK, SWR v2, TanStack Query) y corregir ejemplos de código que ya no compilan, **preservando la voz, el orden y los ejemplos del autor**: no es una reescritura desde cero. Criterio de aceptación: ningún ejemplo usa APIs eliminadas (`createStore`, `activeClassName`, `Switch`, `useSWR<T>` con sintaxis inválida, `PropTypes` presentado como obligatorio en TS) sin una nota que lo advierta.
- **S2 — Índice.** Requisito textual: «que le crees un indice porque es mucho contenido». Alcance: tabla de contenidos al inicio, enlazada, cubriendo `##` y `###`. Criterio de aceptación: cada entrada del índice resuelve a un heading existente y los anclas funcionan **en el blog renderizado**, no solo en Obsidian/GitHub.
- **S3 — Compatibilidad Obsidian.** Requisito textual: «que es un documento compatible con obsidian». Alcance: frontmatter válido, headings reales, callouts `> [!tipo]`, wikilinks internos cuando aporten, sin HTML crudo (el renderer lo deja inerte). Criterio de aceptación: el archivo se abre correctamente en Obsidian y `pnpm run test:boundaries` sigue verde.
- **S4 — Publicado en el blog de Vaqcrow.** Requisito textual: «que sea parte de nuestro blog en vaqcrow». Alcance: `slug` válido, seed migration en `public.blog_post`, test pgTAP, alta en el test de vocabulario, conteo del README. Criterio de aceptación: `GET /blog/:slug` devuelve el artículo y `pnpm run test:db` pasa.
- **S5 — Página en la wiki del asistente.** Requisito textual: «y de nuestra wiki para el asistente». Alcance: `docs/wiki/<slug>.md` con `title`/`type`/`sources`/`updated`, línea en `index.md`, entrada en `log.md`. Criterio de aceptación: `tests/wiki-structure.test.ts` y `wiki-corpus.test.ts` verdes.
- **S6 — Rama e issue.** Requisito textual: «crea una rama nueva ... adelante crea el issue». Hecho: rama `Vaqcrow#617_...` e issue #617.
- **S7 — Restricción del renderer (hallazgo).** El blog renderiza con `react-markdown` + `remark-gfm` sin ids de heading, así que un índice con anclas exige soporte explícito. Supuesto: se agrega `rehype-slug` al renderer, que es la solución estándar y beneficia también a los siete artículos existentes.

## Tasks

- [x] T1 — Estructura del documento: frontmatter, headings reales desde el outline, fences con lenguaje, índice. `S1,S2,S3` · inline · —
- [x] T2 — Soporte de anclas en el renderer (`rehype-slug` + test). `S2` · inline · —
- [x] T3 — Modernización de contenido por secciones. `S1,S3` · delegated · —
- [x] T4 — Publicación en el blog: seed migration, pgTAP, denylist, README. `S4` · inline · —
- [x] T5 — Página de wiki, index y log. `S5` · inline · —
- [~] T6 — Verificación final (verify OK; `test:db` pendiente: Docker no está corriendo) (`pnpm run verify`, `pnpm run test:db`). `S1-S5` · inline · —

## Log

### L1 — Pedido original (verbatim)

> ya esta, vamos a trabajar por un blog @docs/guides/blog/react-essentials.md quiero que lo modernices, que le crees un indice porque es mucho contenido y que es un documento compatible con obsidian, el resto ya sabes que sea parte de nuestro blog en vaqcrow y de nuestra wiki para el asistente, crea una rama nueva no es necesario que crees un issue para esto pero si eso te hace que estemos mas organizado adelante crea el issue

### L2 — Estado inicial medido

- 7.649 líneas / 222 KB, **sin trackear** en git (`??`).
- 395 líneas de negrita sola hacen de pseudo-heading; **1** heading `#` real.
- 491 fences: 207 `js`, 20 `bash`, 9 `ts`, 7 `html`, 2 `css`, y un fence malformado de cuatro backticks.
- No hay fila en `public.blog_post` para este artículo: hoy no se publica.

### L3 — Pipeline verificado (evidencia)

- `GET /blog` lista filas de `public.blog_post` (`supabase-blog-post-repository.ts:27-42`), no archivos del directorio; `GET /blog/:slug` resuelve `source_path` y lee el `.md` (`get-blog-post.ts:44-62`).
- Del frontmatter el parser lee **solo `title` y `tags`** (`front-matter.ts:15-19`); título, resumen y fecha salen de la fila de base (`get-blog-post.ts:55-61`).
- `markdown-body.tsx:131` monta `ReactMarkdown` con `remarkGfm` y nada más: sin `rehype-raw`, sin `rehype-slug`, sin highlight. Los heading bajan un nivel (`:42-47`).
- La wiki se lee desde `docs/wiki/*.md` (`filesystem-wiki-repository.ts:48-81`) y `tests/wiki-structure.test.ts:104-138` exige frontmatter válido, `sources` existentes y que `index.md` coincida exactamente con los archivos.

### L4 — Decisiones

- Se crea el issue #617 y la rama con la convención del repo, aunque el issue era opcional, porque la rama se nombra desde el número.
- El índice cubre `##` y `###` solamente: los 395 pseudo-headings convertidos incluyen pasos de tutorial, y un índice con todos sería inutilizable.
- Anclas: se agrega `rehype-slug` en vez de emitir un índice sin enlaces o con enlaces muertos en el blog.

### L5 — El transform automático no alcanza (medido)

Dry-run sobre las 395 líneas en negrita: 59/59 entradas del outline se consumen, pero el resultado son **368 headings** y 110 leyendas de archivo. Tres clases distintas de negrita conviven:

1. **Secciones reales**: `**Redux**`, `**Context API**`, `**Redux Toolkit (RTK)**` (el texto no coincide literal con el outline, hay que matchear difuso).
2. **Leyendas de código**: `**App.js**`, `**ThemeContext.js**` (van antes de un fence; convertirlas en heading rompe el documento).
3. **Oraciones en negrita**: `**Para la instancia de axios tenemos en la carpeta de lib este archivo;**` — prosa, no título.

Conclusión: la estructura exige criterio por sección, no una regex. Plan revisado: dividir el original en chunks por límites de párrafo (nunca dentro de un fence), delegar cada chunk a un writer con la jerarquía del outline y una guía de estilo común, y mergear determinísticamente en el padre + generar el índice desde los headings resultantes.

### L6 — Modernización: evidencia de obsolescencia

- Cierre del documento: «no debemos usar React 19 para aplicaciones que están en producción ya que todos estos cambios siguen estando en pruebas» + `npm update react@canary react-dom@canary`. React 19 es estable desde diciembre de 2024; esa recomendación ya es incorrecta.
- Redux: el ejemplo usa `createStore`, eliminado en Redux 5.
- React Router: `activeClassName` en `NavLink`, eliminado en React Router v6+.
- `useSWR<User>` escrito como `useSWR < User >` (línea ~1317): no compila.

### L7 — Mirror a Engram pendiente

`mem_save` del documento falló con `could not confirm Engram session registration`. El archivo local es la fuente; reintentar el mirror cuando el servidor responda.

### L8 — Corrección de alcance (owner)

El owner eligió **reescritura completa**, no la opción quirúrgica. Requisitos textuales agregados:

> 2 - regenera el documento completo si es necesario, ese documento es de mi autoria y puede tener problemas de redaccion, problemas de ortografia y incluso ejemplo con errores, verifica la veracidad de los conceptos con fuentes en internet, te dejo la referencia de la documentación de React -> https://react.dev/reference/react

> al final no te olvides de poner que el documento fue pensado por Ariel Duarte pero redactado y mejorado con AI

Esto reemplaza el alcance de S1: se regenera la prosa completa, se corrigen redacción, ortografía y ejemplos, y **cada afirmación técnica se verifica contra fuente primaria**. Se agrega S8 (atribución final) y S9 (verificación con fuentes).

### L9 — Investigación verificada (fuentes primarias, 2026-10-23)

Hallazgos que corrigen el documento original:

| Tema | Documento original | Verificado |
|---|---|---|
| Versión de React | «React 19 sigue en pruebas, no usar en producción» + `npm update react@canary` | React 19 **estable desde 2024-12-05**; actual **19.3.1** (19.3.0 salió 2026-09-09). No existe React 20. |
| React Compiler | no mencionado | **v1.0 estable desde 2025-10-07**; `useMemo`/`useCallback`/`memo` pasan a ser escape hatches |
| React Router | v6 (`Switch`, `activeClassName`) | major actual **v8** (8.5.0), importa desde `"react-router"`; `activeClassName` eliminado en v6 |
| Redux | `createStore` | Redux **5**: `createStore` **deprecado, no eliminado** (alias `legacy_createStore`); se enseña `configureStore` |
| RTK / RTK Query | 1.x implícito | **RTK 2.13.0**; RTK Query es la vía recomendada para estado de servidor |
| SWR | `useSWR < User > (...)` | **SWR 2.5.1**; la forma correcta es `useSWR<User>(key, fetcher)` |
| Zustand / Jotai | — | **Zustand 5.0.16**, **Jotai 3.0.1** (no v2) |
| Forms | RHF sin versión | **RHF 7.83.0** estable (el tag `latest` apunta a un beta de v8: no enseñarlo); **zod 4.6.7**, **yup 1.7.1** |
| Axios | «Interrupt» | **axios 1.20.0**; el término es **interceptor**; cancelación con `AbortController` (`CancelToken` deprecado) |
| PropTypes | recomendado | React 19 **elimina** las validaciones `propTypes` y `defaultProps` en componentes de función; la vía es TypeScript |
| `JSX.Element` | recomendado para children | el namespace global `JSX` desapareció en React 19: `React.JSX.Element`; para children se usa `React.ReactNode` |
| Container/Presentational | patrón recomendado | **desautorizado por Dan Abramov en 2019**: «I don't suggest splitting your components like this anymore» |
| TanStack Query | — | **v5.104.5**, firma de un solo objeto: `useQuery({ queryKey, queryFn })` |
| TypeScript | — | handbook sin cambios: «use interface until you need to use features from type» |

### L10 — Decisiones de arquitectura de la reescritura

- **Obsidian sin wikilinks.** `[[enlace]]` no lo interpreta el renderer del blog y se vería como texto literal. Se usa Markdown estándar, headings reales, callouts `> [!note]` y frontmatter: eso ya es compatible con Obsidian y además se ve bien en el blog. Los wikilinks quedan reservados para `docs/wiki/`, que no pasa por el renderer.
- **Seis unidades paralelas**, cada una escribiendo un archivo propio (`odd/tasks/react-essentials-parts/pN.md`), sin solapamiento; el padre mergea en orden, agrega frontmatter, índice y autoría.
- **Denylist de copy público**: el artículo la cumple evitando los stems prohibidos (`producción` se escribe «entorno real»/«despliegue real»). Si algún uso técnico es inevitable, se declara en `DECLARED_NON_CLAIMS` en T4.
- **Atribución**: sección final `## Autoría` con el texto pedido por el owner.

### L11 — Resultado medido

- Documento reescrito: **2.899 líneas** (antes 7.649), **106 headings** `##`/`###`, **180 fences** balanceados, **103 entradas** de índice.
- **0 hits** de la denylist completa (incluye la mitad «nunca promete»: `promete`, `promesa`, `ganancia`). El artículo usa el nombre del tipo `Promise` en lugar de «promesa», que además es más preciso.
- **103/103 anclas** resuelven contra los slugs reales de `github-slugger`; los tres headings fuera del índice son `Índice`, `Cierre` y `Autoría`, por diseño.
- `rehype-slug` agregado al renderer: los headings del blog ahora tienen `id`. Se verificó que `react-markdown` percent-encodea el fragment del href (`#por-qu%C3%A9-react`), lo cual es válido: el navegador lo decodifica antes de buscar el `id`.
- Gate nuevo `apps/web/src/application/blog/article-index.test.ts` (3 tests): ancla muerta, sección sin indexar y slug duplicado fallan.
- `pnpm run verify` → **EXIT 0** (lint, typecheck, test, build, boundaries, test:boundaries: 190 tests).
- Publicación: seed migration + test pgTAP escritos; **`pnpm run test:db` no se ejecutó** porque el daemon de Docker no está corriendo. La migración **no se aplicó al proyecto remoto**: el cuerpo del artículo viaja en la imagen de la API, así que la fila debe llegar recién después del despliegue (nota incluida en la propia migración).
- Wiki: `docs/wiki/react.md` (`type: tecnologia`, source `blog/react-essentials.md`), línea en `index.md`, entrada `ingest` en `log.md`. `tests/wiki-structure.test.ts` y `tests/wiki-public-copy.test.ts` verdes.
- Atribución: sección final `## Autoría` con «Pensado por Ariel Duarte. Redactado y mejorado con AI.»
- Observación para el owner: la primera versión de la página de wiki decía «no una garantía de velocidad» y el gate de copy público la rechazó dos veces (por `garantía` y luego por `promesa`). Se reescribió en origen; no se agregó ninguna excepción.
