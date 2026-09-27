---
title: Storybook y los dos temas — cómo correrlo y verlo
tags:
  - frontend
  - storybook
  - design-system
---

# Storybook y los dos temas — cómo correrlo y verlo

> **Qué resuelve esto.** El taller de componentes vive en `apps/web/.storybook/` y renderiza las
> primitivas reales con los tokens reales, en claro y en oscuro. Esta guía tiene todo lo necesario para
> levantarlo, verlo en el navegador, cambiar de tema y saber qué está cubierto y qué no.

## Requisitos

- Node `>=24.0.0 <25.0.0` y pnpm `11.27.0` (los pinea `package.json`).
- Dependencias instaladas: `pnpm install --frozen-lockfile` desde la raíz.
- Nada más. Storybook no necesita backend, wallet, Supabase ni Testnet: sólo componentes y CSS.

## Correrlo

```sh
# Desde la raíz del repo
pnpm --filter @vaqcrow/web storybook
```

Abre **http://localhost:6006** en el navegador. El servidor levanta Vite, así que el primer arranque
tarda unos segundos y después el hot reload es inmediato.

Si el puerto está ocupado: `pnpm --filter @vaqcrow/web exec storybook dev -p 6007`.

## Ver la versión estática (sin servidor de desarrollo)

```sh
pnpm --filter @vaqcrow/web build-storybook
# salida: apps/web/storybook-static/  (ignorada por git)

# y para mirarla en el navegador:
pnpm --filter @vaqcrow/web exec serve storybook-static -l 6006
# o, sin agregar nada:
python3 -m http.server 6006 --directory apps/web/storybook-static
```

Es útil para revisar en un dispositivo que no corre el repo, o para adjuntar la carpeta como evidencia.

## Cambiar de tema (claro / oscuro)

En la barra superior de Storybook hay un selector **Claro / Oscuro**. Cambia el atributo `data-theme`
sobre `<html>`, que es **el mismo mecanismo que usa la app**: no hay un tema paralelo en Storybook.

## Cómo funcionan los temas en la app

Los dos temas son un requisito del corpus de diseño (`demo-ui.md` §5.8 y el brief §8) y funcionan así:

| Pieza | Dónde | Qué hace |
|---|---|---|
| Tokens | `apps/web/src/app/globals.css` | Los valores de claro en `@theme`; el bloque `.dark, [data-theme="dark"]` redefine los mismos tokens para oscuro |
| Script de arranque | `apps/web/src/app/layout.tsx` | Lee `vaqcrow-theme` de `localStorage`, resuelve `Sistema` con `matchMedia` y aplica el tema **antes del primer paint** (sin flash) |
| Selector | `apps/web/src/presentation/components/theme-switcher.tsx` | `Claro` / `Oscuro` / `Sistema` en el encabezado; persiste la elección y sigue los cambios del sistema |
| Marcadores | `<html>` | El script y el selector mueven **la clase `dark` y el atributo `data-theme`** juntos |

**Marcadores duplicados a propósito.** HeroUI documenta `class="dark" data-theme="dark"` y su hoja de
estilos acepta cualquiera de los dos; el `@custom-variant dark` de `globals.css` también acepta ambos.
Así, `dark:` de Tailwind y los tokens de HeroUI conmutan con el mismo interruptor.

**La elección se persiste** en `localStorage` bajo `vaqcrow-theme` con los valores `light`, `dark` o
`system`. `Sistema` es un valor propio: se sigue resolviendo dinámicamente, no se congela al elegirlo.

### Agregar un token que funcione en los dos temas

1. Definilo en el bloque `@theme` de `globals.css` con el valor claro.
2. Redefinilo en el bloque `.dark, [data-theme="dark"]` con el valor oscuro.
3. Usalo con las utilidades de Tailwind (`bg-tu-token`). No definas colores locales en componentes.

`--color-muted`, `--color-background` y el resto del set semántico de HeroUI **no** se redefinen acá:
`@heroui/styles` los provee y ya trae su valor oscuro.

## Qué está cubierto hoy

| Historia | Cubre |
|---|---|
| `Primitivas/Badge` | Las familias de badge, y que ningún tono lee como éxito |
| `Primitivas/TrustBanner` | Las cuatro variantes de banner de confianza |
| `Primitivas/CanonicalDisclosure` | Los seis avisos canónicos, verbatim |

### Agregar una historia

Creá `src/presentation/components/<componente>.stories.tsx` (el glob es
`../src/**/*.stories.@(ts|tsx)`):

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MiComponente } from "./mi-componente";

const meta = { title: "Primitivas/MiComponente", component: MiComponente } satisfies Meta<typeof MiComponente>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Basico: Story = {};
```

Reglas de la casa: mostrar **texto visible** en cada estado (el significado nunca vive sólo en color o
icono), cubrir los estados críticos del inventario de `demo-ui.md` §7, y no poner datos reales ni
secretos.

## Lo que hay que saber antes de tocar esto

> [!warning] `storybook init` no sirve en este repo
> Su detección de framework falla en este monorepo, así que la configuración es manual. No pierdas
> tiempo con el camino de un comando: `main.ts` y `preview.ts` ya están escritos.

> [!warning] `build-storybook` reescribe `postcss.config.mjs`
> Cada corrida normaliza `apps/web/postcss.config.mjs` a la forma objeto
> (`plugins: { "@tailwindcss/postcss": {} }`). El build funciona con las dos formas, pero si la revertís
> va a volver a aparecer modificada en el próximo build. Está aceptado.

> [!note] La accesibilidad está configurada, no exigida
> `@storybook/addon-a11y` corre con `a11y.test: "error"`, pero eso sólo **falla** cuando las historias se
> ejecutan como tests (addon de Vitest o test runner). Hoy reporta en el panel y no rompe nada en CI.
> No lo tomes como un gate que corre.

> [!note] Storybook queda fuera de `pnpm run verify`
> A propósito: no queremos que el gate documentado del repo se ponga lento ni sume flake. Se corre con
> sus propios scripts.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `Unable to initialize Storybook in this directory` | Es el fallo conocido de `storybook init`; no lo uses. La config ya está. |
| El tema no cambia al tocar el selector de Storybook | Verificá que `globals.css` esté importado en `.storybook/preview.ts` y que exista el bloque `.dark, [data-theme="dark"]`. |
| En la app el tema cambia pero los componentes de HeroUI no | Asegurate de que el script/selector estén moviendo **también** la clase `dark`, no sólo el atributo. |
| Un `pnpm install` borró paquetes de Storybook | Los paquetes están en `devDependencies` de `apps/web`; corré `pnpm install --frozen-lockfile` desde la raíz. |
| El puerto 6006 está ocupado | `pnpm --filter @vaqcrow/web exec storybook dev -p 6007`. |
| `storybook-static/` aparece en `git status` | No debería: está en `.gitignore`. Si aparece, revisá esa entrada. |
