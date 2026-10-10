import { describe, expect, it } from "vitest";
import { disclosures } from "../trust/disclosures";
import { HELP_CATEGORIES, HELP_COPY, HELP_FAQS, helpResultLabel } from "../help/faq";
import { ENTREPRENEUR_GUIDE } from "../guides/entrepreneur-guide";
import { INVESTOR_GUIDE } from "../guides/investor-guide";
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

const ABOUT_TEXT = collectStrings(ABOUT_COPY).join("\n");
const ENTREPRENEUR_TEXT = collectStrings(ENTREPRENEUR_GUIDE).join("\n");
const INVESTOR_TEXT = collectStrings(INVESTOR_GUIDE).join("\n");
const HELP_TEXT = collectStrings({ HELP_COPY, HELP_CATEGORIES, HELP_FAQS }).join("\n");
const PUBLIC_TEXT = [ABOUT_TEXT, ENTREPRENEUR_TEXT, INVESTOR_TEXT, HELP_TEXT].join("\n");

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
