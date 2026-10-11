/**
 * Shared shapes for the public guides (Feature #394, WU1), React-free so the
 * verbatim copy lives in `application/` and the presentation layer (WU3) only
 * renders it. Icons are Ionicons names exactly as the template writes them;
 * the presentation maps each name to its component.
 *
 * Copy is verbatim from `docs/design/template/Vaqcrow Guia emprendedores.dc.html`
 * and `Vaqcrow Guia de inversion.dc.html`. The template's login gate
 * (`:91-102` in both files) is deliberately not modelled: the owner made the
 * guides public.
 */

export interface GuideLink {
  readonly label: string;
  readonly href: string;
}

export interface GuideTocEntry {
  /** Anchor id of the section this entry links to. */
  readonly id: string;
  readonly label: string;
}

export interface GuideCard {
  readonly icon: string;
  readonly title: string;
  readonly body: string;
  /** Semantic tone the template paints the item with; only the outcome cards set it. */
  readonly tone?: "ok" | "warn" | "error" | "info";
}

export interface GuideBandedItem {
  readonly icon: string;
  readonly tone: "ok" | "warn" | "error" | "info";
  readonly label: string;
}

export interface GuideState {
  readonly icon: string;
  /** The «Estado N» eyebrow the template prints above the title. */
  readonly label: string;
  readonly title: string;
  readonly body: string;
}

export interface GuideTerm {
  readonly term: string;
  readonly definition: string;
}

/** An accent-headed callout inside a section (lead + emphasised lead-in + tail). */
export interface GuideCallout {
  readonly lead: string;
  readonly strong: string;
  readonly tail: string;
}

export interface GuideWorkedExample {
  readonly salesLabel: string;
  /** The «SIMULADO» marker the template appends to the sales row. */
  readonly salesTag: string;
  readonly salesValue: string;
  readonly ruleLabel: string;
  readonly ruleValue: string;
  /** Investor example only: the rounding row. */
  readonly roundingLabel?: string;
  readonly roundingValue?: string;
  readonly resultLabel: string;
  readonly resultValue: string;
  readonly footnote: string;
}

export interface GuideSection {
  /** Anchor id, e.g. "requisitos". */
  readonly id: string;
  /** Heading id the template sets on the `<h2>`, e.g. "requisitos-t". */
  readonly headingId: string;
  /** Two-digit index the template prints as the eyebrow ("01".."07"). */
  readonly index: string;
  readonly title: string;
  readonly body?: string;
  /** Icon-led bullet list (requisitos, perder, garantias). */
  readonly items?: readonly string[];
  /** Icon/title/body cards. */
  readonly cards?: readonly GuideCard[];
  /** Term/definition rows (bóveda terms, glosario). */
  readonly terms?: readonly GuideTerm[];
  readonly bands?: readonly GuideBandedItem[];
  readonly states?: readonly GuideState[];
  /** The two outcome cards of «Si llegás o no a la meta». */
  readonly outcomes?: readonly GuideCard[];
  readonly callout?: GuideCallout;
  /** A titled sub-list, e.g. «Qué valoran los aportantes». */
  readonly valuedTitle?: string;
  readonly valued?: readonly GuideCard[];
  readonly workedExample?: GuideWorkedExample;
}

export interface GuideFinalCta {
  readonly title: string;
  readonly body: string;
  readonly cta: GuideLink;
}

export interface Guide {
  readonly eyebrow: string;
  /** Decorative Ionicons name the template puts inside the eyebrow pill. */
  readonly eyebrowIcon: string;
  readonly titleLead: string;
  readonly titleAccent: string;
  readonly subtitle: string;
  /** The dashed note beside the hero. */
  readonly note: string;
  readonly ctas: readonly GuideLink[];
  readonly toc: readonly GuideTocEntry[];
  readonly sections: readonly GuideSection[];
  readonly finalCta: GuideFinalCta;
}
