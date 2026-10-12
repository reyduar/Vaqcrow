# Bitácora — Favicon con el isotipo de Vaqcrow

## Objetivo

Task [#478](https://github.com/reyduar/Vaqcrow/issues/478): que todas las rutas de `apps/web` muestren el isotipo de Vaqcrow como favicon en la pestaña del navegador.

## Por qué

El `RootLayout` (`apps/web/src/app/layout.tsx`) no declaraba ningún icono, así que los navegadores mostraban el favicon por defecto.

## Rama

- **Rama:** `Vaqcrow#478_Task_Use_the_Vaqcrow_logo_as_the_favicon` (off `main`).

## Decisión de implementación

Se usa la **convención de archivo del App Router** de Next: `apps/web/src/app/icon.png` junto al `layout.tsx` de la raíz. Next lo detecta, lo sirve como `/icon.png` y emite el `<link rel="icon">` en el `<head>` de **todas** las rutas del subárbol — sin dependencias nuevas ni cambios en el `metadata` a mano (que es la otra opción que planteaba el issue).

El isotipo fuente (`apps/web/public/vaqcrow-isotipo.png`, 592×579) se copia **reescalado a 512 px** (`sips -Z 512` → 512×500) como `src/app/icon.png`. No se toca el asset de marca original. Se optó por no agregar `apple-icon.png`: el issue lo listaba como alternativa, no como requisito, y el `icon.png` cubre todas las rutas listadas.

## Unidad de trabajo

- [x] **U1 — Icono + test.** RED: `apps/web/src/app/favicon.test.ts` (dos casos: el archivo de convención existe y es un PNG real) falla porque `icon.png` no existe. GREEN: se agrega `src/app/icon.png` derivado del isotipo; los dos casos pasan.

## Verificación

- Test: `pnpm --filter @vaqcrow/web exec vitest run src/app/favicon.test.ts` → 2/2 PASS.
- **Head construido** (AC «the built HTML head contains the icon link(s)»): tras `pnpm --filter @vaqcrow/web build`, el HTML prerenderizado contiene
  `<link rel="icon" href="/icon.png?icon.<hash>.png" sizes="512x500" type="image/png"/>`, presente en `/`, `/explore`, `/company`, `/portfolio`, `/admin`, `/about` y `/help` (1 link por ruta). Next además rutea `/icon.png` como asset estático.
- `pnpm run verify` → **EXIT=0**, tareas 5/8/5 verdes (los «2 problems» de lint son los dos warnings preexistentes de `admin-users.test.tsx`, 0 errores).

## Lo que queda para el ojo humano

No corrí un navegador real: verifiqué el `<head>` construido de cada ruta, que es la prueba más fuerte sin navegador. Falta la mirada rápida de la pestaña en el navegador (la pestaña muestra el isotipo).
