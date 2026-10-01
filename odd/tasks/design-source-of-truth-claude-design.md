# Align the design source of truth on the Claude Design template

Iteration log for the change that retires Google Stitch as the design source of truth and names the
Claude Design template in its place.

## Objective

Record, in the repository, that Google Stitch is no longer the source of truth for Vaqcrow's design and
that the visual source of truth is the Claude Design template on disk at `docs/design/template/`. Remove
every **live** Stitch claim from the documents that carried one, and document the template's share link.

## Decision

Owner decision, **2026-10-01**: the visual source of truth is the **Claude Design template**, not Google
Stitch. The owner asked for the Stitch reference to be removed and for this share link to be documented:

```
https://claude.ai/design/p/d16823bf-de57-404f-a94b-6a3ad638a770?file=Vaqcrow+Landing.html&via=share
```

The authority on what the template intends is the owner's own brief and continuation pack, both tracked:

- `docs/design/claude-design-brief.md` — design system and intent.
- `docs/design/claude-design-continuation-pack.md` — the gap and the per-screen conventions.

This log links them rather than restating them.

## The template, as verified on disk

`docs/design/template/` is **gitignored on purpose**. The measured decision (25 MB, 78% of its text is one
build artifact, nothing in the build reads it, and the review gate refuses it as a single candidate) is
recorded in `odd/tasks/template-stays-out-of-the-repo.md`. **No template file is un-ignored and none is
committed** by this change.

14 screens, each a `.dc.html` file, verified with `ls docs/design/template/*.dc.html`:

1. `Vaqcrow Landing.dc.html`
2. `Vaqcrow Landing export.dc.html`
3. `Vaqcrow Portafolio.dc.html`
4. `Vaqcrow Explorar PyMEs.dc.html`
5. `Vaqcrow Detalle PyME.dc.html`
6. `Vaqcrow Informes.dc.html`
7. `Vaqcrow Sistema.dc.html`
8. `Vaqcrow Admin.dc.html`
9. `Vaqcrow Ayuda.dc.html`
10. `Vaqcrow Onboarding.dc.html`
11. `Vaqcrow Onboarding PyME.dc.html`
12. `Vaqcrow Guia emprendedores.dc.html`
13. `Vaqcrow Guia de inversion.dc.html`
14. `Vaqcrow Acerca de.dc.html`

plus `support.js` (shared runtime), `image-slot.js`, `assets/`, `uploads/` (screenshots and a copy of the
brief) and `screenshots/`.

## Files touched

| File | Change |
|---|---|
| `docs/design/demo-ui.md` | Opening blocks, the "Resumen de decisiones" row, the incidental Stitch citations in §1–§10; **§11/§12 retitled and marked `Retirado` (historical record kept)**, with a new "El template de Claude Design" section added; §13.4, §14, §15 and the §16/§17 Stitch headings reconciled. |
| `docs/design/claude-design-brief.md` | Its opening note named Stitch; it now names the template as the source of truth and demotes Stitch to the retired record. |
| `docs/architecture/monorepo.md` | The "tratar Stitch o su HTML generado como implementación autoritativa" prohibition and the "runbook de Google Stitch" link. |
| `docs/planning/demo-tasks-list.md` | The #53 requirement line named the Stitch project as the visual reference. |
| `docs/planning/DEMO.md` | The recommended-stack row named the Stitch project as the visual reference. |
| `docs/planning/trust-disclosures-and-synthetic-fixtures-evidence.md` | Dated evidence; a `Retirado` callout, original sentence kept. |
| `docs/planning/trust-disclosures-and-contract-custody-evidence.md` | Dated evidence; a `Retirado` callout, original sentence kept. |
| `docs/planning/trust-disclosures-and-synthetic-fixtures-dependency-gate.md` | Dated gate record; a `Retirado` callout, original sentence kept. |
| `odd/tasks/claude-design-brief.md` | Dated iteration log; a `Superseded` callout, original text kept. |
| `odd/tasks/deterministic-testing-and-ci-gates.md` | Dated iteration log; a `Retirado` callout, original text kept. |
| `odd/tasks/roadmap-sync-and-trust-disclosures-follow-ups.md` | Dated iteration log; a `Retirado` callout, original text kept. |

`odd/tasks/design-source-of-truth-claude-design.md` is this log.

## Judgment calls

- **`demo-ui.md` §11/§12 are retitled and marked `Retirado`, not deleted.** The task asked to *retire*
  them and *replace* them with a Claude Design section, and the repo's callout convention is to keep the
  original text and annotate it (`docs/planning/campaign-vault-web-journey-evidence.md`). So §11 ("Plan de
  ejecución con Google Stitch MCP") and §12 ("Prompts listos para copiar y pegar") keep their full text
  under a `> [!warning] Retirado (2026-10-01)` callout, and a new **"El template de Claude Design (fuente
  de verdad visual)"** section (unnumbered, placed after "Resumen de decisiones") takes their place. The
  prompts were **not** re-invented as Claude Design prompts — the live prompt set is the brief's §10 and
  the pack's §4.
- **The new section is unnumbered; §11–§17 keep their numbers.** Placing the Claude Design section between
  "Resumen de decisiones" and §1 avoids renumbering every cross-reference. References that named the
  template's role now point at that section; references to the retired Stitch material (§11.6, §11.9) are
  explicitly historical.
- **`docs/design/demo-ui.md` cross-references to `§11.8` (handoff) were left as historical text.** Only the
  ones that named Stitch as the design medium were rewritten.
- **`§16.A "Diseñado en Stitch"` was reframed** to "Diseñado con el template de Claude Design" using the
  verified on-disk inventory and the continuation pack's gap, rather than leaving a retired execution
  checklist as a live definition-of-done stage.

## Open question — `.mcp.json`

`.mcp.json` still configures the `stitch` MCP server (`https://stitch.googleapis.com/mcp`, header
`X-Goog-Api-Key` from `STITCH_API_KEY`). Removing a tool from the owner's configuration is the owner's
call, so the file was **not touched**; the open question is whether to remove the `stitch` server now that
Stitch is no longer the design source.

Two files outside the authorized scope also carry a `stitch` hit and were **not touched**:
`README.md` (2 hits, including a live "Stitch" paragraph and a "Google Stitch" link label; it looks like
it is covered by the separate `odd/tasks/readme-and-demo-architectures.md` work) and `b2.json` (1 hit,
inside an exported GitHub issue body). Both are reported, not changed.

## Commits

- `65cea9ed83474ab3f036e176e944fa25ff4c07cd` — `docs(design): retire Stitch as the design source of truth in demo-ui` (`docs/design/demo-ui.md`).
- `c668ff89cd3b921b0d3470f3a456418d38d46454` — `docs: point remaining Stitch references at the Claude Design template` (the other ten documents).
- The log itself lands in the third commit of this change (`docs(odd): …`); its hash is recorded in the change's report/PR.
