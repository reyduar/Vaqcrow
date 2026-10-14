import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { disclosures } from "../trust/disclosures";
import { HELP_CATEGORIES, HELP_COPY, HELP_FAQS, helpResultLabel } from "../help/faq";
import { ENTREPRENEUR_GUIDE } from "../guides/entrepreneur-guide";
import { INVESTOR_GUIDE } from "../guides/investor-guide";
import { TERMS_COPY } from "../legal/terms";
import { parseHowItWorks } from "../landing/how-it-works";
import { HOW_IT_WORKS_GUIDE, readGuideSource } from "../../infrastructure/guides/read-guide-source";
import { BLOG_COPY } from "../blog/copy";
import { ASSISTANT_COPY } from "../assistant/copy";
import { ABOUT_COPY } from "./copy";

/**
 * Feature #394 / WU1: the public About page, the two guides and the help
 * centre are static, owner-facing content. Two things are pinned here.
 *
 * 1. Presence — the copy the template designs must actually be there: the
 *    seven sections of each guide, the four help categories, the nine FAQs and
 *    the section/heading ids the anchors and the TOC depend on.
 * 2. Prohibited terms — the same negative-regex denylist the repo applies to
 *    the contract-custody disclosure (`application/trust/contract-custody.test.ts`)
 *    is applied to the new copy. The template's own honesty copy legitimately
 *    contains a few of those stems as *denials* ("no garantiza…", "Sin retorno
 *    garantizado", "Nada asegura…") and as ordinary Spanish ("asegurate",
 *    "Sin garantías"); those exact phrases are declared below and scrubbed
 *    before the denylist runs, so a real claim elsewhere still fails.
 */

/** Recursively collect every string value, including nested arrays/objects. */
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
  return out;
}

const WORKSPACE_MANIFEST = "pnpm-workspace.yaml";

/**
 * Reads one Blog article from `docs/guides/blog/` (#498). The slug is a bare
 * file name, and the guides root is resolved by walking up to the workspace
 * manifest — never by counting `..` levels — mirroring
 * `infrastructure/guides/read-guide-source.ts`.
 */
function readBlogArticle(fileName: string, from: string = process.cwd()): string {
  let directory = from;
  let root: string | undefined;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(directory, WORKSPACE_MANIFEST))) {
      root = directory;
      break;
    }
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  if (root === undefined) {
    throw new Error(`No ${WORKSPACE_MANIFEST} above ${from}; cannot resolve docs/guides/blog`);
  }
  return readFileSync(join(root, "docs", "guides", "blog", fileName), "utf8");
}

/** Drops a leading `---` front-matter block (S8: front matter is not body text). */
function stripFrontMatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
}

const ABOUT_TEXT = collectStrings(ABOUT_COPY).join("\n");
const ENTREPRENEUR_TEXT = collectStrings(ENTREPRENEUR_GUIDE).join("\n");
const INVESTOR_TEXT = collectStrings(INVESTOR_GUIDE).join("\n");
const HELP_TEXT = collectStrings({ HELP_COPY, HELP_CATEGORIES, HELP_FAQS }).join("\n");
const TERMS_TEXT = collectStrings(TERMS_COPY).join("\n");
/**
 * The landing's 「Cómo funciona」 section renders this guide (#497), so its text is
 * public copy too: it runs through the same denylist as the copy above.
 */
const HOW_IT_WORKS_TEXT = collectStrings(parseHowItWorks(readGuideSource(HOW_IT_WORKS_GUIDE))).join("\n");
/**
 * Feature #498: the Blog's static labels (the About section's copy rides inside
 * `ABOUT_COPY`; these are the listing/article page labels).
 */
const BLOG_TEXT = collectStrings(BLOG_COPY).join("\n");
/**
 * Feature #498: every Blog article is public copy. The body ships as a
 * `docs/guides/blog/*.md` file served by the API (owner decisions D2/D3), so it
 * never lands in a web bundle — but its words run through the same denylist as
 * the landing's 「Cómo funciona」 guide. The front matter is stripped first,
 * mirroring how that guide source is scanned (S8).
 */
const BLOG_ARTICLE_SOURCE = "vaqcrow-sobre-stellar.md";
const BLOG_ARTICLE_TEXT = stripFrontMatter(readBlogArticle(BLOG_ARTICLE_SOURCE));
/**
 * Feature #499: the help assistant's web-side chrome (labels, placeholders and
 * the failure/access strings) is public copy too, so it runs through the same
 * denylist as the copy above. The four fixed answers (out-of-scope,
 * no-documentation, account, cap) are owned by the API, not here.
 */
const ASSISTANT_TEXT = collectStrings(ASSISTANT_COPY).join("\n");
const PUBLIC_TEXT = [
  ABOUT_TEXT,
  ENTREPRENEUR_TEXT,
  INVESTOR_TEXT,
  HELP_TEXT,
  TERMS_TEXT,
  HOW_IT_WORKS_TEXT,
  BLOG_TEXT,
  BLOG_ARTICLE_TEXT,
  ASSISTANT_TEXT
].join("\n");

/**
 * The exact template sentences/phrases that contain a denylist stem without
 * making a claim. Each must be present (asserted below) so the exemption can
 * never silently go stale, and each is removed before the denylist runs.
 */
const DECLARED_NON_CLAIMS: readonly string[] = [
  // Guía para emprendedores, hero note: a disclaimer, not a promise.
  "no garantiza que tu campaña se financie",
  // Guía para emprendedores, section 07 heading.
  "Qué no garantiza la plataforma",
  // Guía para emprendedores, requisitos: the vos imperative «asegurate».
  "asegurate de tener",
  // Guía para emprendedores, TOC label.
  "Sin garantías",
  // Guía de inversión, revenue-share card title.
  "Sin retorno garantizado",
  // Guía de inversión, revenue-share card body: a disclaimer.
  "Nada asegura que la PyME venda lo suficiente para devolver el capital aportado.",
  // Ayuda, first FAQ answer: a disclaimer.
  "no tiene retorno garantizado"
];

/** Mirrors `application/trust/contract-custody.test.ts:45-63`. */
const PROHIBITED: readonly RegExp[] = [
  /auditad/i,
  /producción/i,
  /listo para/i,
  /legalidad/i,
  /solvencia/i,
  /garantiz/i,
  /garantía/i,
  /rentabilidad/i,
  /asegur/i,
  /retorno/i,
  /proveedor(es)? de calidad/i
];

describe("public copy — prohibited terms (#394)", () => {
  it("carries no prohibited claim outside the owner-mandated non-claim phrases", () => {
    let scrubbed = PUBLIC_TEXT;
    for (const phrase of DECLARED_NON_CLAIMS) {
      expect(PUBLIC_TEXT).toContain(phrase);
      scrubbed = scrubbed.split(phrase).join(" ");
    }
    for (const pattern of PROHIBITED) {
      expect(scrubbed).not.toMatch(pattern);
    }
  });

  it("never promises a return", () => {
    // `rendimiento` is deliberately absent: the creator bio legitimately says
    // «sistemas de compliance de alto rendimiento». The financial-return terms
    // are already covered by the denylist above (`retorno`, `rentabilidad`).
    expect(PUBLIC_TEXT).not.toMatch(/promete|promesa|ganancia/i);
  });

  it("does not duplicate a canonical disclosure in full", () => {
    for (const disclosure of Object.values(disclosures)) {
      expect(PUBLIC_TEXT).not.toContain(disclosure.text);
    }
    // The canonical no-production sentence belongs to CanonicalDisclosure only.
    expect(ABOUT_TEXT).not.toContain("no constituye una oferta de inversión");
  });
});

describe("Blog article copy (#498)", () => {
  it("is scanned as public copy and exercises the renderer's features", () => {
    // The body reached the denylist above through `PUBLIC_TEXT`; pin that it
    // carries the Markdown the renderer must show (headings, lists, a table, a
    // fenced code block and a blockquote) and the front matter is stripped.
    expect(BLOG_ARTICLE_TEXT).toContain("# Vaqcrow: financiar");
    expect(BLOG_ARTICLE_TEXT).toContain("| Pieza |");
    expect(BLOG_ARTICLE_TEXT).toContain("```sh");
    expect(BLOG_ARTICLE_TEXT).toContain("- el *crowdfunding*");
    expect(BLOG_ARTICLE_TEXT).toContain("> Es una demo.");
    // A leading `title` + `tags` block, per `docs/guides/storybook.md` (S8).
    expect(readBlogArticle(BLOG_ARTICLE_SOURCE)).toMatch(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  });
});

describe("About copy (#394)", () => {
  it("pins the section and heading ids the page anchors use", () => {
    expect(ABOUT_COPY.hero.headingId).toBe("ab-t");
    expect(ABOUT_COPY.mission.headingId).toBe("mv-t");
    expect(ABOUT_COPY.pillars.headingId).toBe("que-t");
    expect(ABOUT_COPY.creator.sectionId).toBe("creador");
    expect(ABOUT_COPY.creator.headingId).toBe("cr-t");
    expect(ABOUT_COPY.contact.sectionId).toBe("contacto");
    expect(ABOUT_COPY.contact.headingId).toBe("ct-t");
  });

  it("carries the hero, the four stack rows and the six pillars", () => {
    expect(ABOUT_COPY.hero.eyebrow).toBe("Financiamiento PyME · Stellar Testnet");
    expect(`${ABOUT_COPY.hero.titleLead}${ABOUT_COPY.hero.titleAccent}`).toBe("Acerca de Vaqcrow");
    expect(ABOUT_COPY.stack.rows).toHaveLength(4);
    expect(ABOUT_COPY.pillars.items).toHaveLength(6);
    expect(ABOUT_COPY.pillars.items[1]?.body).toContain("“La IA recomienda; una persona decide.”");
  });

  it("points the academic callout at the canonical disclosure instead of retyping it", () => {
    expect(ABOUT_COPY.pillars.academicCallout.disclosure).toBe("no-production");
    expect(ABOUT_COPY.pillars.academicCallout.title).toBe(
      "Proyecto académico · Trabajo Fin de Máster en Desarrollo con IA"
    );
  });

  it("carries the creator identity, three stats and the four real contact links", () => {
    expect(ABOUT_COPY.creator.name).toBe("Ariel Duarte");
    expect(ABOUT_COPY.creator.stats).toHaveLength(3);
    expect(ABOUT_COPY.contact.ctas.map((cta) => cta.href)).toEqual([
      "https://www.linkedin.com/in/arielduarte",
      "https://discord.gg/XnsH2FvSr",
      "mailto:contact@vaqcrow.com",
      "https://github.com/reyduar"
    ]);
  });
});

describe("Blog copy (#498)", () => {
  it("pins the About Blog section heading id and the listing labels", () => {
    expect(ABOUT_COPY.blog.headingId).toBe("blog-t");
    expect(ABOUT_COPY.blog.title).toBe("Blog");
    expect(ABOUT_COPY.blog.seeAll).toBe("Ver todos los artículos");
    expect(BLOG_COPY.list.title).toBe("Blog");
    expect(BLOG_COPY.article.notFoundTitle).toBe("No encontramos este artículo");
  });
});

describe("Guide copy (#394)", () => {
  it("exports the seven entrepreneur sections with their ids and headings", () => {
    expect(ENTREPRENEUR_GUIDE.sections.map((section) => section.id)).toEqual([
      "requisitos",
      "evidencia",
      "evaluacion",
      "boveda",
      "meta",
      "despues",
      "garantias"
    ]);
    expect(ENTREPRENEUR_GUIDE.sections.map((section) => section.headingId)).toEqual([
      "requisitos-t",
      "evidencia-t",
      "evaluacion-t",
      "boveda-t",
      "meta-t",
      "despues-t",
      "garantias-t"
    ]);
    expect(ENTREPRENEUR_GUIDE.toc.map((entry) => entry.id)).toEqual(
      ENTREPRENEUR_GUIDE.sections.map((section) => section.id)
    );
  });

  it("exports the seven investor sections with their ids and headings", () => {
    expect(INVESTOR_GUIDE.sections.map((section) => section.id)).toEqual([
      "revenue",
      "perder",
      "riesgo",
      "evidencia",
      "boveda",
      "calculo",
      "glosario"
    ]);
    expect(INVESTOR_GUIDE.sections.map((section) => section.headingId)).toEqual([
      "revenue-t",
      "perder-t",
      "riesgo-t",
      "evidencia-t",
      "boveda-t",
      "calculo-t",
      "glosario-t"
    ]);
    expect(INVESTOR_GUIDE.toc.map((entry) => entry.id)).toEqual(
      INVESTOR_GUIDE.sections.map((section) => section.id)
    );
  });

  it.each([
    ["entrepreneur", ENTREPRENEUR_GUIDE],
    ["investor", INVESTOR_GUIDE]
  ] as const)("carries the worked example in the %s guide", (_name, guide) => {
    const example = guide.sections.map((section) => section.workedExample).find(Boolean);
    expect(example).toBeDefined();
    expect(example?.salesValue).toBe("ARS 3.745.800,00");
    expect(example?.ruleValue).toBe("× 4,5 %");
    expect(example?.resultValue).toBe("ARS 168.561,00");
  });
});

describe("Help copy (#394)", () => {
  it("exports the four categories in template order", () => {
    expect(HELP_CATEGORIES.map((category) => category.label)).toEqual([
      "Cómo funciona",
      "Cuenta y wallet",
      "Stellar Testnet",
      "Aportes y reembolsos"
    ]);
  });

  it("exports the nine FAQs, every one assigned to a known category", () => {
    expect(HELP_FAQS).toHaveLength(9);
    const categoryIds = new Set(HELP_CATEGORIES.map((category) => category.id));
    for (const faq of HELP_FAQS) {
      expect(categoryIds.has(faq.category)).toBe(true);
      expect(faq.id.length).toBeGreaterThan(0);
      expect(faq.question.length).toBeGreaterThan(0);
      expect(faq.answer.length).toBeGreaterThan(0);
    }
  });

  it("carries the search, result, empty-state and About copy the template designs", () => {
    expect(HELP_COPY.hero.title).toBe("¿Cómo podemos ayudarte?");
    expect(HELP_COPY.search.placeholder).toBe("Buscá preguntas o términos, por ejemplo “reembolso”");
    expect(HELP_COPY.clearFilter).toBe("Ver todas");
    expect(HELP_COPY.emptyState.title("reembolso")).toBe("No encontramos resultados para “reembolso”");
    expect(HELP_COPY.upcoming).toContain("Próximamente");
    expect(helpResultLabel(1)).toBe("1 pregunta");
    expect(helpResultLabel(3, "Cómo funciona")).toBe("3 preguntas en Cómo funciona");
  });

  it("points the contact block at the real email and the investor guide", () => {
    expect(HELP_COPY.contact.email).toEqual({
      label: "Escribir al equipo",
      href: "mailto:contact@vaqcrow.com"
    });
    expect(HELP_COPY.contact.guide.href).toBe("/investor-guide");
  });
});

describe("Assistant copy (#499)", () => {
  it("names the assistant and pins the access and failure strings", () => {
    expect(ASSISTANT_COPY.title).toBe("Asistente de Vaqcrow");
    expect(ASSISTANT_COPY.subtitle).toBe("Respuestas de la documentación");
    expect(ASSISTANT_COPY.send).toBe("Enviar");
    // The one string not in the approved D8 list: the per-user flag (D9) is off.
    expect(ASSISTANT_COPY.errors.forbidden).toBe(
      "El asistente todavía no está habilitado para tu cuenta."
    );
    expect(ASSISTANT_COPY.errors.unavailable).not.toBe(ASSISTANT_COPY.errors.network);
    expect(ASSISTANT_COPY.errors.not_configured).toContain("API");
  });
});

describe("Terms copy (#394)", () => {
  it("renders the standard sections in order", () => {
    expect(TERMS_COPY.title).toBe("Términos y Condiciones");
    expect(TERMS_COPY.sections.map((section) => section.heading)).toEqual([
      "Aceptación",
      "Qué es Vaqcrow",
      "Naturaleza de la demo",
      "Sin oferta de inversión ni asesoramiento",
      "Stellar Testnet y valor económico",
      "Firma no custodial",
      "Datos simulados",
      "La IA es asesora, no decide",
      "Elegibilidad",
      "Propiedad intelectual",
      "Limitación de responsabilidad",
      "Cambios a estos términos",
      "Contacto"
    ]);
  });

  it("reuses the canonical notices instead of retyping them", () => {
    const disclosuresUsed = TERMS_COPY.sections
      .map((section) => section.disclosure)
      .filter((id): id is NonNullable<typeof id> => Boolean(id));
    expect(new Set(disclosuresUsed)).toEqual(
      new Set(["no-production", "testnet", "non-custody", "simulation", "human-ai"])
    );
  });

  it("points the contact section at the real email", () => {
    expect(TERMS_COPY.contact).toEqual({
      label: "Escribir al equipo",
      href: "mailto:contact@vaqcrow.com"
    });
  });
});
