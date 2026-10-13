# Bitácora — «Guía del inversor» en el header público

## Objetivo

Task [#500](https://github.com/reyduar/Vaqcrow/issues/500): que el header público muestre «Guía del inversor» → `/investor-guide`, para que un visitante que quiere invertir llegue a la guía tan fácil como el que quiere emprender.

## Por qué

`PUBLIC_VIEW.nav` (`apps/web/src/application/navigation/shell-nav.ts`) tenía cuatro entradas y la guía del inversor solo era alcanzable desde el menú del `INVERSOR` logueado, el footer y las FAQ. El owner la pidió en el header (2026-10-13). El template no dibuja esa entrada.

## Rama

- **Rama:** `Vaqcrow#500_Task_Add_the_investor_guide_link_to_the_public_landing_header` (off `main`).

## La decisión: dónde salió el ancho

Agregar una quinta entrada **no entraba**. El issue lo había previsto («si cinco entradas no entran, registrá la pregunta de layout y no inventes una»), así que se midió con el e2e que existe justo para eso (`e2e/app-header.spec.ts`, viewport 1280 px; incluye la simulación del texto ~4 % más ancho de Linux/Windows vía `letter-spacing: 0.03em`):

| Variante | Texto normal | Texto 4 % más ancho |
| --- | --- | --- |
| Etiquetas actuales + la nueva (5) | **−41 px** (`scrollWidth 592` / `clientWidth 551`) | **−85 px** |
| «Emprendedores» / «Inversores» (5) | entra | **−6 px** |

El nav **nunca se envuelve** (`@md:flex-nowrap`): el desborde es scroll lateral con el último ítem clipeado. O sea: el header se había quedado sin lugar para una quinta entrada de primer nivel.

**Decisión del owner (2026-10-13): opción B** — recuperar el ancho del selector de tema: los tres botones de 44 px del template (~138 px con padding y borde) pasan a **un trigger de 46 px que abre un menú**, y esos ~92 px son los que paga la quinta entrada. Se descartó A (acortar etiquetas: cambiaba una etiqueta existente y quedaba a 6 px en el peor caso) y C (aceptar el scroll lateral: header clipeado en desktop).

## Unidades de trabajo

- [x] **U1 — La entrada.** `PUBLIC_VIEW.nav` suma `{ label: "Guía del inversor", href: "/investor-guide" }` después de «Para emprendedores». Sigue siendo solo datos: el presentador no cambia.
- [x] **U2 — El selector de tema colapsado.** `theme-switcher.tsx`: un trigger de 44 px (icono de la elección vigente, `aria-haspopup="menu"`) y un menú `role="menu"` con tres `role="menuitemradio"` y `aria-checked`. Se conservan las mecánicas del `AccountMenu`: foco al ítem elegido al abrir, flechas/Home/End, Escape cierra y devuelve el foco, click afuera cierra, foco saliendo cierra. La lógica de almacenamiento/`prefers-color-scheme` no se tocó.
- [x] **U3 — Tests.** `theme-switcher.test.tsx` reescrito al patrón de menú (7 casos: trigger cerrado, apertura con la elección marcada, aplicar+persistir+cerrar, Escape con foco de vuelta, persistencia, `Sistema` contra el SO, storage denegado); expectativas de nav en `shell-nav.test.ts`, `app-header.test.tsx` y `e2e/app-header.spec.ts`; los dos tests que solo verificaban la presencia del control de tema (`admin-console.test.tsx`, `auth-screen.test.tsx`) pasan al trigger.
- [x] **U4 — El presupuesto documentado.** El comentario de `demo-navbar.tsx` que explicaba el ancho del header ahora registra de dónde salió el espacio de la quinta entrada y la holgura medida.

## Verificación

- **Medición del header** (`pnpm --filter @vaqcrow/web exec playwright test e2e/app-header.spec.ts`, 1280 px): **los 2 casos pasan**. Holgura del nav: **52 px** con texto normal y **9 px** con texto ~4 % más ancho. Los dos positivos.
- `pnpm run verify` → **EXIT=0**. `@vaqcrow/web`: 223 archivos / 2200 tests. `depcruise`: sin violaciones (1253 módulos).
- Dos tests ajenos fallaron al principio (`admin-console`, `auth-screen`) porque buscaban el `role="group"` «Tema»: se actualizaron al trigger. Es el contrato viejo del template, no un efecto colateral.

## Evaluación de seguridad (`owasp-security`, #502)

El cambio no toca autenticación, permisos, inputs, uploads, render de contenido no confiable, prompts ni secretos: es navegación y un menú. **Sin superficie de seguridad nueva**; el único acceso a datos es `localStorage` para la preferencia de tema, que ya existía.

## Lo que queda para el ojo humano

- **La holgura de 9 px es el presupuesto real.** Cualquier etiqueta de nav más larga o cualquier control más ancho la come, y el e2e falla primero —por eso la guarda existe—, pero conviene saber que el header está al límite otra vez.
- La mirada visual del menú de tema abierto (posición, sombra, contraste en los dos temas) y del header con cinco entradas.
- El template dibujaba tres botones de tema y ahora hay uno: es la desviación que pagó la quinta entrada, aceptada por el owner.
