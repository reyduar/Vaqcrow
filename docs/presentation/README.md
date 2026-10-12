# Presentación — Demo TFM

Deck de la demo de Vaqcrow para el **Trabajo Fin de Máster** (Máster en Desarrollo con IA).
La fuente es `demo-deck.md`, un archivo **Marp** (Markdown) versionado en el repo: el mismo
contenido se exporta a PDF, PPTX o HTML sin editar la fuente a mano.

## Contenido

El deck no inventa material: sintetiza fuentes ya verificadas del repositorio.

- **Narrativa por rol** y **rutas reales** — `docs/planning/final-build-and-presentation-freeze-evidence.md` §4 y `docs/planning/DEMO.md` §3.
- **Real vs. simulado** — `DEMO.md` §4.
- **Disclaimers** — copiados **verbatim** de `DEMO.md` §12 / `docs/design/demo-ui.md` §2 (copia canónica machine-checked en `apps/web/src/application/trust/disclosures.ts`).
- **Qué se validó** — `docs/planning/demo-rehearsal-and-evidence-packaging-evidence.md` (#33) y `docs/planning/final-build-and-presentation-freeze-evidence.md` (#34).
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
- Vista previa en vivo: `npx @marp-team/marp-cli@latest -p --allow-local-files demo-deck.md` (o la extensión **Marp for VS Code**).

> [!info] Marp es tooling del **operador**, no una dependencia del repo
> Se corre con `npx` para no sumarlo a `pnpm run verify` ni al gate de CI. El deck es un
> artefacto de presentación; no forma parte del build de producto.

## Salidas generadas

- **`demo-deck.pdf` se versiona** — es el entregable para el tribunal (19 páginas, exportado desde `demo-deck.md`).
- `demo-deck.html` y `demo-deck.pptx` son salidas de trabajo: se generan cuando hagan falta y **no** necesitan versionarse.

> [!important] Regenerar el PDF al cambiar la fuente
> El PDF es una **instantánea** de `demo-deck.md`. Si editás la fuente, reexportá el PDF para que el entregable vuelva a coincidir con ella (no se genera solo). El export a PDF requiere que Marp descargue Chromium una vez.
