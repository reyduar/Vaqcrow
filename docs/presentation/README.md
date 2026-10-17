# Presentación — Demo TFM

Deck de la demo de Vaqcrow para el **Trabajo Fin de Máster** de Reynaldo Ariel Duarte (Máster en Desarrollo con IA E.2, BIG school).
La fuente es `demo-deck.md`, un archivo **Marp** (Markdown) versionado en el repo: el mismo
contenido se exporta a PDF, PPTX o HTML sin editar la fuente a mano.

## Contenido

El deck no inventa material: sintetiza fuentes ya verificadas del repositorio.

- **Narrativa por rol** y **rutas reales** — `docs/planning/final-build-and-presentation-freeze-evidence.md` §4 y `docs/planning/DEMO.md` §3.
- **Real vs. simulado** — `DEMO.md` §4.
- **Disclaimers** — los siete, copiados **verbatim** de la copia canónica machine-checked en `apps/web/src/application/trust/disclosures.ts` (incluye «Aportes por encima de la meta», #579).
- **Qué se validó** — `docs/planning/demo-rehearsal-and-evidence-packaging-evidence.md` (#33) y `docs/planning/final-build-and-presentation-freeze-evidence.md` (#34); el conteo de tests y del corpus de evidencia se actualizó el 2026-10-17.
- **Revenue share, asistente y cómo se construyó** — el tope de 1,5× (#580) y el tope de aportes (#579), el asistente anclado a la wiki (#499) y el stack gentle-ai/ODD (#600), con su fuente en el Blog y el README.
- **Decisiones abiertas y límites** — freeze #34 §8 y §9.

## Exportar

No hace falta instalar nada: se usa `npx`.

```bash
cd docs/presentation

# HTML (no necesita navegador)
npx @marp-team/marp-cli@latest demo-deck.md -o demo-deck.html --allow-local-files

# PPTX (editable en PowerPoint/Keynote; no necesita navegador)
npx @marp-team/marp-cli@latest demo-deck.md -o demo-deck.pptx --allow-local-files

# PDF (descarga Chromium la primera vez)
npx @marp-team/marp-cli@latest demo-deck.md -o demo-deck.pdf --allow-local-files
```

- `--allow-local-files` es necesario porque el slide de portada usa el isotipo local (`apps/web/public/vaqcrow-isotipo.png`).
- **PDF** requiere que Marp descargue Chromium (una sola vez). Si el entorno lo bloquea, exportá **HTML** o **PPTX**, que no lo necesitan.
- Si el export se queda colgado sin error, Marp está esperando entrada por stdin: pasa cuando el comando corre en segundo plano o desde un script. Agregá `--no-stdin`.
- Vista previa en vivo: `npx @marp-team/marp-cli@latest -p --allow-local-files demo-deck.md` (o la extensión **Marp for VS Code**).

> [!info] Marp es tooling del **operador**, no una dependencia del repo
> Se corre con `npx` para no sumarlo a `pnpm run verify` ni al gate de CI. El deck es un
> artefacto de presentación; no forma parte del build de producto.

## Salidas generadas

- **`demo-deck.pdf` se versiona** — es el entregable para el tribunal y la versión final para el video de presentación (26 páginas, exportado desde `demo-deck.md` el 2026-10-17).
- `demo-deck.html` y `demo-deck.pptx` son salidas de trabajo: se generan cuando hagan falta y **no** necesitan versionarse.

> [!important] Regenerar el PDF al cambiar la fuente
> El PDF es una **instantánea** de `demo-deck.md`. Si editás la fuente, reexportá el PDF para que el entregable vuelva a coincidir con ella (no se genera solo). El export a PDF requiere que Marp descargue Chromium una vez.
