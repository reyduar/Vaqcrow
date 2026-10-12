# Bitácora: deck de presentación del TFM

Artefacto de presentación para el TFM (Máster en Desarrollo con IA): el deck de la demo, en
**Marp** (Markdown → PDF/PPTX/HTML), versionado en el repo.

- **Fuente:** `docs/presentation/demo-deck.md`
- **Export y convenciones:** `docs/presentation/README.md`
- **Contexto de partida:** `docs/planning/final-build-and-presentation-freeze-evidence.md` (#34, freeze) — §4 narrativa por rol, §5 disclaimers exactos, §7 artefactos, §8 decisiones abiertas, §9 límites.

## Por qué

El freeze de #34 congeló el **contenido** (narrativa, disclaimers, evidencia) pero **no produjo el deck**. El TFM necesitaba el material de presentación, que hoy no existía.

## Decisiones

- **Formato — Marp (Markdown → PDF/PPTX).** Decisión del owner (2026-10-12): fuente versionada en el repo, encaja con el vault markdown, reproducible y exportable a lo que pida el tribunal. Descartadas: deck HTML con reveal.js y `.pptx` directo.
- **Ubicación — `docs/presentation/`.** Directorio nuevo; `docs/design/` es para diseño de producto, no para material de presentación.
- **Sin dependencias nuevas.** Marp se corre con `npx`; **no** entra en `pnpm run verify` ni en CI.
- **Disclaimers verbatim.** Los seis avisos se copian exactos del freeze §5; el de «Custodia por contrato» se corrigió a su forma completa (se había condensado en el primer borrador).

## Estado

- [x] WU1 — Escribir el deck (`docs/presentation/demo-deck.md`, 19 slides, español, acento de marca `#8a05be`).
- [x] WU2 — README de export (`docs/presentation/README.md`).
- [x] WU3 — Exportar a PDF y versionarlo (`docs/presentation/demo-deck.pdf`, 19 páginas; **es el entregable** para el tribunal). Decisión del owner (2026-10-12).
- [ ] Follow-up opcional — capturas de pantalla / video del recorrido por roles (paquete de respaldo de #33), si el owner los quiere en el deck.

## Verificación

- Readback estructural del markdown y `git status` en esta unidad.
- El deck es **pasivo** (documento): no hay comportamiento runnable propio.
- Claim-check: cada afirmación del deck se apoya en una fuente nombrada del repo (freeze #34, `DEMO.md`, `README.md`); ningún dato de producción se inventa.

## Notas

- La portada usa el isotipo real (`apps/web/public/vaqcrow-isotipo.png`), por eso el export necesita `--allow-local-files`.
- Rutas del deck en **inglés** (como el producto); la UI y el deck, en español.
