# Bitácora — Cursor de mano en botones

## Objetivo

Task [#479](https://github.com/reyduar/Vaqcrow/issues/479): que todo botón y control con forma de botón muestre el cursor de **mano** al pasar el mouse, y que un control **deshabilitado** nunca lo muestre.

## Por qué

Tailwind v4 no pone `cursor` en `<button>` y su preflight tampoco (verificado: `tailwindcss@4.3.3/preflight.css` no tiene ninguna regla de cursor para botones), así que el navegador aplica su default —la flecha— en todos los botones; sólo un puñado de componentes sumaban `cursor-pointer` a mano.

## Rama

- **Rama:** `Vaqcrow#479_Task_Show_the_pointer_cursor_on_clickable_buttons` (off `main`).

## Decisión

Una **sola regla global en `@layer base`** (el issue la prefería por sobre salpicar `cursor-pointer` por componente). Al vivir en la base layer, cualquier componente puede seguir pisándola con una utilidad `cursor-*` (las utilidades ganan sobre la base), y las pocas clases `cursor-pointer` que ya existían se dejan como están: son inocuas y no vale la pena el churn.

La regla cubre: `button:not(:disabled):not([aria-disabled="true"])`, `input` de tipo button/submit/reset habilitados, `[role="button"]:not([aria-disabled="true"])` y `summary` → `cursor: pointer`; y `button:disabled`, `button[aria-disabled="true"]`, esos `input:disabled` y `[role="button"][aria-disabled="true"]` → `cursor: not-allowed`.

## Unidad de trabajo

- [x] **U1 — Regla global + guard.** Regla en `apps/web/src/app/globals.css`; test estructural `apps/web/src/app/cursor-pointer.test.ts` que guarda su presencia (jsdom no aplica Tailwind, así que el cursor renderizado no es asertable ahí).

## Verificación

- **CSS compilado** (la prueba más fuerte sin navegador): tras `pnpm --filter @vaqcrow/web build`, el stylesheet global emitido contiene
  `button:not(:disabled):not([aria-disabled=true]),input:where([type=button],[type=submit],[type=reset]):not(:disabled),[role=button]:not([aria-disabled=true]),summary{cursor:pointer}`
  y `button:disabled,…,{cursor:not-allowed}`.
- **Sin override:** se revisaron todas las reglas `cursor:default` del CSS emitido — son sólo HeroUI y están acotadas a sub-elementos (`slider__thumb[data-disabled]`, `switch`/`checkbox`/`radio` `[data-slot=description|field-error]`), ninguna a botones. Los botones de HeroUI renderizan un `<button>`, así que la regla los cubre.
- `pnpm run verify` → **EXIT 0**, tareas 5/8/8/5 verdes (los «2 problems» de lint son los dos warnings preexistentes de `admin-users.test.tsx`, 0 errores).

## Lo que queda para el ojo humano

No corrí un navegador real: verifiqué que la regla está activa en el stylesheet global (aplica a todas las rutas) y que nada la pisa. El hover real sobre las rutas listadas en el issue (`/`, `/explore`, `/company`, `/portfolio`, `/admin`) queda como el vistazo de confirmación.
