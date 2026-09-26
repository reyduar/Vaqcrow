# Claude Design continuation pack (missing screens)

Iteration log for: closing the screen gap the template audit found, and giving the owner the exact
inputs to regenerate the missing views in Claude Design with the fidelity of the existing set.

## Objective

Deliver a continuation pack that (a) states the exact gap with evidence, (b) documents the real
conventions the existing 15 `.dc.html` pieces follow, and (c) carries a ready-to-paste prompt per
missing screen, so the set can be completed in the same tool and come out consistent.

## Problem

The template has dedicated screens for ~11 of the 19 flows. Missing: **Billetera/fondeo** (the one
where contract custody, signing and refund live), **Registro de PyME**, **Tokenización** and
**Notificaciones**. `Admin` is one screen standing in for three flows, and advanced filters are a
nominative mention inside `Explorar PyMEs`, not an experience.

## Why not hand-write the `.dc.html` files

Honest constraint, recorded so the decision is reviewable:

- Claude Design cannot be driven from this environment; there is no tool for it.
- The pieces are ~30–60 KB each of hand-authored markup with inline styles plus a per-screen
  `DCLogic` script. Mirroring one would mean authoring hundreds of lines per screen.
- There is no browser here, so a hand-written `.dc.html` could not be rendered or verified. Shipping
  four unrendered prototypes as if they were done would be a fake completion, and they would diverge
  from what the generator produces.

The pack is the verifiable path: it is text, checkable against the brief and against the existing
pieces, and it plugs straight back into the tool that made them.

## Scope

In:

- `docs/design/claude-design-continuation-pack.md`: the gap table, the observed conventions of the
  existing set, one filled prompt per missing screen, the acceptance checks, and the cleanup list.

Out:

- No change to the 15 existing `.dc.html` files.
- No hand-written prototype screens (see Why).
- No code, token or dependency change.

## Source of truth used

The 15 files under `docs/design/template/` (read directly: shell, `<style>` token block, `DCLogic`
script, `<sc-if>`/`<sc-for>` grammar, `data-props`), `docs/design/claude-design-brief.md` §5 and §10,
and `docs/design/demo-ui.md` §2/§8 for the trust constraints and the inherited screens.

## Evidence gathered

- 15 `.dc.html`, 25 MB total, untracked.
- Tokens match the brief exactly (`#8A05BE`, canvas/surface/text light + dark).
- Trust constraints respected: `No apto para producción` 14/15, `TESTNET` 15/15, `SIMULADO` 14/15,
  `sin valor económico` 14/15, `IA recomienda` 7/15; the 7 prohibited terms from §6.3 appear zero times.
- No Tailwind, no HeroUI, no React: static HTML + `support.js` (generated `dc-runtime`) + inline CSS.
- Shell is shared and cross-linked by filename; nav omits `Billetera`, consistent with the missing screen.

## Acceptance criteria

- [ ] The gap is stated with per-flow evidence, not adjectives
- [ ] The conventions section is specific enough that a generated screen matches the existing set
- [ ] Every missing screen has a filled, ready-to-paste prompt
- [ ] The prompts carry the trust constraints and the prohibited terms
- [ ] There is a verification checklist for the generated output
- [ ] The cleanup list states what must not be versioned

## Tasks

- [x] T1 — Explore the format and the exact gap
- [x] T2 — Write the continuation pack
- [x] T3 — Structural verification and commit

## Verification evidence

| Unit | Command | Result |
| --- | --- | --- |
| T3 | `grep` de control sobre las piezas reales | Filtro=2, Riesgo=2, Sector=0, Monto=0, Plazo=0 en `Explorar PyMEs`; `Gestión de PyMEs`=0 en `Admin`; `Billetera`=0 en la nav |
| T3 | `grep -c 'Portafolio\|Informes'` como control de alternancia | 4 — confirma que el `grep` citado en el pack discrimina |
| T3 | `pnpm run test:boundaries` | 7 archivos / 83 tests |
| T3 | RDD assess desde el límite revisado (`564e305`) | `risk=passive`, 3 paths, 419 líneas, `review_due=false` (`passive`) — sin revisión debida |

> [!note] Sobre el límite usado
> El assess se corrió desde el commit del brief (`564e305`), que es el último límite revisado. Eso
> re-incluye el commit del log del brief (`a53fe82`), ya revisado; el resultado sigue siendo `passive`
> y no cambia la decisión.

## Progress

- 2026-09-26 — Read the shell, the token block, the `DCLogic` script and the `sc-if`/`sc-for` grammar
  from the existing pieces; measured per-file composition (style ~1 KB, script 3–14 KB, the rest is
  markup) and confirmed the pieces are generated, not hand-authored to a simple pattern.
- 2026-09-26 — Wrote the pack (330 líneas): hueco con evidencia, tabla de derivación hermana por
  pantalla, convenciones del set, 6 prompts llenos, checklist de verificación y limpieza.
- 2026-09-26 — El assess ahora **exige declarar los archivos sin trackear**: el árbol de 25 MB de
  `docs/design/template/` lo dispara. Se corrió con `--untracked-scope=exclude` y el hash de inventario
  esperado, que es la intención real (no trackearlo todavía).

## Next step

Listo para pushear y extender PR #298.
