# Bitácora — Desbordes de texto y CTA de las cards como botón primario

## Objetivo

Task [#501](https://github.com/reyduar/Vaqcrow/issues/501): que ningún texto, badge o chip se salga de su contenedor en ninguna pantalla, y que «Ver evidencia y riesgo» de las cards sea un **botón primario** en vez de un link de texto.

## Por qué

El owner (2026-10-13) reportó desbordes («ya vi varios y es antiestético»). El ejemplo reportado: la fila de badges del card de aporte del detalle de campaña, donde «TESTNET · Activos sin valor económico» no envolvía y se salía del borde derecho del card.

## Rama

- **Rama:** `Vaqcrow#501_Task_Fix_text_overflow_across_screens_and_make_the_Explore_card_CTA_a_primary_button` (off `main`).

## Unidades de trabajo

### U1 — El desborde reportado

La fila era `flex items-center justify-between gap-2` **sin `flex-wrap`**. Se agregó `flex-wrap`: la fila hace lugar y el badge conserva su etiqueta completa — nunca se trunca, porque es un badge de confianza y `demo-ui.md` §2 manda que siga legible.

### U2 — La auditoría, automatizada

En vez de auditar a ojo, se agregó `apps/web/e2e/no-overflow.spec.ts`: recorre **9 pantallas públicas × 375 / 768 / 1280 px** (27 casos) y falla si algún elemento se pasa del ancho del documento.

Dos ajustes hicieron falta para que mida lo que importa:

- **Ignora lo decorativo** (`aria-hidden="true"`): el círculo decorativo de «Acerca de» está a propósito en `right-[-40px]`.
- **Ignora lo que un ancestro clipea o scrollea** (`overflow-x: hidden|clip|auto|scroll`): si está recortado, no puede empujar la página.

Hallazgos y límites, declarados:

- **Encontró un solo desborde real: el reportado.** Las otras diez filas con badges que el barrido de código marcó eran `flex-col` (una columna no desborda horizontalmente) y se revisaron una por una.
- **Es una guarda a nivel página**: un elemento que desborda *su card* pero queda dentro del viewport se le escapa. Por eso el caso reportado queda cubierto por el test de componente de U1, no solo por el e2e.
- **No cubre las pantallas logueadas** (`/company`, `/portfolio`, `/reports`, `/admin`): necesitan sesión y el e2e corre como invitado.

### U3 — El CTA como botón primario, en todas

Decisión del owner (2026-10-13): **en todas** — Explorar, el grid «PyMEs en campaña» de la landing y el card destacado. Los dos lugares mostraban la misma etiqueta con tratamientos distintos (un `<Link>` de solo texto en `campaign-card.tsx` y el control *outlined* de `featured-campaign.tsx`, que es la imagen que el owner marcó como «esto no»).

- **Un solo origen para las clases del botón.** `button.tsx` exporta `buttonClasses(variant)`, que `Button` usa internamente: así el botón y el *link con forma de botón* no pueden divergir.
- **`campaign-card.tsx`**: la rama `href` pasó de un `<Link>` de HeroUI sin clases a un `<Link>` de `next/link` con la clase primaria (`bg-brand-accent`, `text-on-accent`, `rounded-control`, `h-11`), a ancho completo y centrado. Sigue siendo un **anchor**: navega, no es un `<button>` con onClick. Conserva `href` y el `aria-label` rico («Ver evidencia y riesgo de <PyME>»).
- **`featured-campaign.tsx`**: `CTA_CLASS` pasó del tratamiento *outlined* a `buttonClasses("primary")`.

## Verificación

- `pnpm run verify` → **EXIT=0**. `@vaqcrow/web`: 223 archivos / 2201 tests. `depcruise`: sin violaciones (1253 módulos).
- **Auditoría e2e**: `playwright test e2e/no-overflow.spec.ts` → **27/27 pasan**, incluido el detalle de campaña y `/explore` con el CTA nuevo.
- Tests de componente: el CTA es `role="link"`, un anchor, con la clase primaria y el `aria-label` intacto (`campaign-card.test.tsx`), y el card destacado dejó el *outlined* (`featured-campaign.test.tsx`).

## Evaluación de seguridad (`owasp-security`, #502)

El cambio no toca ninguna superficie de seguridad: son clases y un anchor cuyo `href` ya venía del view-model de marketplace (construido desde el id de campaña). Ni auth, ni permisos, ni inputs, ni uploads, ni render de contenido no confiable, ni prompts, ni secretos. **Sin hallazgos.**

## Lo que queda para el ojo humano

- **Los screenshots de antes/después que pide el DoD no se pueden adjuntar por API.** Lo verificado por código es: la fila envuelve, el badge no se trunca, el CTA es un anchor con estilo primario y ningún elemento se pasa del ancho en 27 combinaciones pantalla×ancho. La confirmación visual del CTA (que se vea como el botón de la imagen del owner) queda para el owner.
- El CTA ahora es un botón a ancho completo dentro del card: si el owner lo prefiere alineado a la izquierda o de ancho natural, es un cambio de una clase.
