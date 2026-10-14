# Esquema de la wiki del asistente (`docs/wiki/`)

Este documento define **cómo se escribe y se mantiene** la wiki que alimenta al asistente de ayuda (Feature [#499](https://github.com/reyduar/Vaqcrow/issues/499)). Es el "schema document" del método *LLM Wiki* de Karpathy: las fuentes crudas son inmutables, la wiki la compila el agente y **la revisa una persona por PR**, y este archivo fija el contrato de esa compilación.

> [!important] La wiki es corpus, no producto
> Nada de lo que hay acá se le muestra a la persona tal cual. El asistente lee `index.md` para elegir páginas, lee esas páginas y recién entonces **redacta** una respuesta corta en español, citando la página de la que sale. La wiki tiene que ser precisa y verificable; la respuesta tiene que ser clara.

## 1. Las tres capas

```
docs/guides/     fuentes crudas, inmutables (las comparte el Blog, #498)
   ↓  un agente, siguiendo este esquema (operaciones ingest y lint)
docs/wiki/       páginas compiladas + index.md + log.md
   →  revisión humana en el PR; lint periódico (contradicciones, claims viejos, huérfanas)
```

- **Fuentes crudas** (`docs/guides/`): solo las guías de usuario. Hoy son `como-funciona-vaqcrow.md`, `freighter-and-testnet-walkthrough.md` y los artículos de `blog/`. `docs/guides/storybook.md` (guía para desarrolladores) queda **fuera** de la wiki (decisión D1).
- **Wiki** (`docs/wiki/`): las páginas compiladas. Es lo único que el asistente lee además de la pregunta.
- **Este esquema**: el contrato. Si cambia el formato de `index.md` o los tipos de página, se cambia acá primero.

## 2. Tipos de página

Una página es **un tema**, no un archivo fuente. Varias fuentes pueden alimentar una página, y una fuente puede alimentar varias.

| Tipo | Qué responde | Ejemplo de slug |
|---|---|---|
| `concepto` | Qué es una cosa y por qué existe | `revenue-share.md`, `todo-o-nada.md` |
| `flujo` | El recorrido completo de una operación, paso a paso | `alta-de-pyme.md`, `distribucion-mensual.md` |
| `tecnologia` | Qué tecnología hay detrás y qué garantiza | `boveda-soroban.md`, `freighter-y-firmas.md` |
| `pantalla` | Qué hace cada pantalla y qué puede hacer ahí el usuario | `mi-campana.md`, `explorar-pymes.md` |
| `limite` | Qué es real y qué es simulado, y los límites de la demo | `que-es-real-y-que-es-simulado.md` |

Reglas:

- **Tipo `pantalla`**, además del texto, declara el `screen` (la ruta de la app, p. ej. `/company`) para que el asistente pueda enlazar a la pantalla relevante. Es la única metadata que sale de la wiki hacia la respuesta.
- **Tipo `limite`** es obligatorio: las reglas de honestidad de la demo (Testnet sin valor económico, KYC/KYB y conversión ARS simulados, IA que sólo asesora, no custodial) tienen que estar en una página, no repartidas.

## 3. Formato de una página

Front matter (YAML, como `docs/guides/`):

```yaml
---
title: Distribución mensual del revenue share
type: flujo
sources:
  - como-funciona-vaqcrow.md
updated: 2026-10-14
---
```

- `title`: en español, una línea.
- `type`: uno de los de la tabla de §2.
- `sources`: los archivos de `docs/guides/` de los que sale la página. **Toda afirmación de la página tiene que poder rastrearse a un `source`.**
- `screen` (sólo `type: pantalla`): la ruta de la app, p. ej. `/company`.
- `updated`: la fecha de la última edición (ISO `YYYY-MM-DD`).

Cuerpo: Markdown en **español**, frases cortas, sin emojis. Sin promesas de rentabilidad ni claims de producción (misma vara que la copy pública). Se permiten encabezados, listas y tablas.

## 4. `index.md`

Es el **único** archivo que el asistente lee siempre (el router). Una línea por página, en el orden en que conviene leerlas:

```markdown
- [revenue-share](revenue-share.md): qué es y cómo se calcula el reparto, en proporción al aporte.
- [distribucion-mensual](distribucion-mensual.md): el recorrido del reparto mes a mes, y quién firma.
```

- El enlace y el nombre del archivo son el **id** de la página: el router devuelve esos ids y el código sólo acepta ids que estén en el índice.
- La descripción es **una línea**, orientada a que el router elija bien.

## 5. `log.md`

Bitácora de la wiki, en orden cronológico inverso. Una entrada por corrida:

```markdown
## 2026-10-14 — ingest inicial
- Se compilaron N páginas desde 3 fuentes de `docs/guides/`.
- Abiertas: `x.md` (falta cubrir el cobro).
```

Prefijos de entrada: `ingest` (compilar/actualizar), `lint` (revisar), `human` (una decisión de la revisión por PR).

## 6. Operaciones

### `ingest` (compilar/actualizar)

1. Leer la fuente cruda completa.
2. Crear o actualizar las páginas que correspondan (una por tema, no una por archivo).
3. Actualizar `index.md` (alta, baja o reescritura de la línea).
4. Añadir la entrada en `log.md`.
5. Abrir el PR: **una persona revisa** antes de mergear.

### `lint` (revisar)

- **Contradicciones** entre páginas.
- **Claims viejos**: una afirmación que la app o las fuentes ya no respaldan.
- **Huérfanas**: páginas que el `index.md` no lista, o listadas sin archivo.
- **Fuentes sin cubrir**: temas de `docs/guides/` que ninguna página toca.

El lint también se revisa por PR.

## 7. Límites

- **No se usan embeddings** ni búsqueda vectorial (decisión del owner). El router navega el índice.
- **Escala**: este método anda bien hasta ~100 fuentes / unos cientos de páginas. Si el corpus crece más, el paso siguiente documentado es un prefiltro léxico (BM25 o full-text de Postgres en español), **todavía sin embeddings**.
- **Sin inventar**: una página sin `source` no entra. Una pregunta sin página responde «no tengo documentación», nunca se contesta desde el conocimiento del modelo.
