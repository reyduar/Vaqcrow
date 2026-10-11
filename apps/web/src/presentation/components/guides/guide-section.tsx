import { Fragment } from "react";
import type {
  GuideBandedItem,
  GuideCallout,
  GuideCard,
  GuideSection as GuideSectionData,
  GuideState,
  GuideTerm
} from "@/application/guides/types";
import { GUIDE_ICONS, type GuideIconName } from "./guide-icons";
import { WorkedExample } from "./worked-example";

/**
 * One guide section (`Vaqcrow Guia emprendedores.dc.html` `:125-131`,
 * `Vaqcrow Guia de inversion.dc.html` `:124-130`): the index eyebrow, the
 * `<h2>` and whichever sub-block the data carries. The section renders from
 * `GuideSection` and never retypes copy — every string is a data field.
 *
 * Two fields serve two template shapes, so the layout is chosen from the data:
 * - `states` renders uniformly: the optional `label` is the «Estado N» eyebrow
 *   (bóveda) and is simply absent for the evidence states, whose icons share
 *   the accent tint.
 * - `terms` renders as filled tiles (bóveda's campaign terms) except in the
 *   «Glosario», whose template shape is a ruled definition list. The section id
 *   is the discriminator, since the template gives the two the same data shape.
 */
interface ItemIconConfig {
  readonly icon: GuideIconName;
  readonly className: string;
}

const DEFAULT_ITEM_ICON: ItemIconConfig = { icon: "checkmark-circle-outline", className: "text-brand-accent-text" };

const ITEM_ICON_BY_SECTION: Readonly<Record<string, ItemIconConfig>> = {
  requisitos: DEFAULT_ITEM_ICON,
  perder: { icon: "alert-circle-outline", className: "text-trust-caution" },
  garantias: { icon: "close-circle-outline", className: "text-trust-critical" }
};

const OUTCOME_TONE_CLASS: Readonly<Record<NonNullable<GuideCard["tone"]>, string>> = {
  ok: "text-trust-success",
  warn: "text-trust-caution",
  error: "text-trust-critical",
  info: "text-trust-info"
};

const BAND_TONE_CLASS: Readonly<Record<GuideBandedItem["tone"], string>> = {
  ok: "bg-trust-success-surface text-trust-success",
  warn: "bg-trust-caution-surface text-trust-caution",
  error: "bg-trust-critical-surface text-trust-critical",
  info: "bg-trust-info-surface text-trust-info"
};

function CardGrid({ cards }: { readonly cards: readonly GuideCard[] }) {
  return (
    <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const CardIcon = GUIDE_ICONS[card.icon as GuideIconName];
        return (
          <li key={card.title} className="flex flex-col gap-2 rounded-card border border-border p-5">
            <CardIcon aria-hidden="true" focusable="false" className="text-[22px] text-brand-accent-text" />
            <h3 className="m-0 text-[17px] font-bold">{card.title}</h3>
            <p className="m-0 text-sm leading-[1.55] text-text-secondary">{card.body}</p>
          </li>
        );
      })}
    </ul>
  );
}

function ItemList({
  items,
  sectionId
}: {
  readonly items: readonly string[];
  readonly sectionId: string;
}) {
  const config = ITEM_ICON_BY_SECTION[sectionId] ?? DEFAULT_ITEM_ICON;
  const ItemIcon = GUIDE_ICONS[config.icon];
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-[15px] leading-[1.5]">
          <ItemIcon aria-hidden="true" focusable="false" className={`mt-px shrink-0 text-[19px] ${config.className}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function OutcomeCards({ outcomes }: { readonly outcomes: readonly GuideCard[] }) {
  return (
    <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
      {outcomes.map((outcome) => {
        const OutcomeIcon = GUIDE_ICONS[outcome.icon as GuideIconName];
        const toneClass = OUTCOME_TONE_CLASS[outcome.tone ?? "ok"];
        return (
          <li key={outcome.title} className="flex flex-col gap-2 rounded-card border border-border p-[18px]">
            <div className={`flex items-center gap-2 text-base font-bold ${toneClass}`}>
              <OutcomeIcon aria-hidden="true" focusable="false" className="text-[20px]" />
              {outcome.title}
            </div>
            <span className="text-sm leading-[1.55] text-text-secondary">{outcome.body}</span>
          </li>
        );
      })}
    </ul>
  );
}

function BandRow({ bands }: { readonly bands: readonly GuideBandedItem[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {bands.map((band) => {
        const BandIcon = GUIDE_ICONS[band.icon as GuideIconName];
        return (
          <span
            key={band.label}
            className={`inline-flex h-[26px] items-center gap-1 rounded-pill px-2.5 text-[13px] font-semibold ${BAND_TONE_CLASS[band.tone]}`}
          >
            <BandIcon aria-hidden="true" focusable="false" className="text-[15px]" />
            {band.label}
          </span>
        );
      })}
    </div>
  );
}

function StateGrid({ states }: { readonly states: readonly GuideState[] }) {
  return (
    <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {states.map((state) => {
        const StateIcon = GUIDE_ICONS[state.icon as GuideIconName];
        return (
          <li key={state.title} className="flex flex-col gap-1.5 rounded-card border border-border p-5">
            {state.label ? <span className="text-xs text-text-secondary">{state.label}</span> : null}
            <div className="flex items-center gap-2 font-bold">
              <StateIcon aria-hidden="true" focusable="false" className="text-[19px] text-brand-accent-text" />
              {state.title}
            </div>
            <span className="text-sm leading-[1.5] text-text-secondary">{state.body}</span>
          </li>
        );
      })}
    </ol>
  );
}

function TermList({ terms, glossary }: { readonly terms: readonly GuideTerm[]; readonly glossary: boolean }) {
  if (glossary) {
    return (
      <dl className="m-0 grid gap-0 border-t border-border sm:grid-cols-[minmax(140px,200px)_minmax(0,1fr)]">
        {terms.map((term) => (
          <Fragment key={term.term}>
            <dt className="border-b border-border py-3.5 text-[15px] font-[650]">{term.term}</dt>
            <dd className="m-0 border-b border-border py-3.5 text-[15px] text-text-secondary">{term.definition}</dd>
          </Fragment>
        ))}
      </dl>
    );
  }

  return (
    <dl className="m-0 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {terms.map((term) => (
        <div key={term.term} className="rounded-control bg-page-surface p-3.5">
          <dt className="text-sm font-[650]">{term.term}</dt>
          <dd className="mt-1 mb-0 text-[13px] leading-[1.45] text-text-secondary">{term.definition}</dd>
        </div>
      ))}
    </dl>
  );
}

function Callout({ callout }: { readonly callout: GuideCallout }) {
  // The template paints the «¿Esto es tokenizar…?» Q&A with a help glyph and
  // the process callouts with a person glyph; the question mark is the signal.
  const CalloutIcon = callout.strong.trim().endsWith("?")
    ? GUIDE_ICONS["help-circle-outline"]
    : GUIDE_ICONS["person-outline"];
  return (
    <div className="flex gap-3 rounded-card bg-page-surface p-4">
      <CalloutIcon aria-hidden="true" focusable="false" className="mt-0.5 shrink-0 text-[20px]" />
      <p className="m-0 text-[15px] leading-[1.55]">
        {callout.lead}
        <strong className="font-[650]">{callout.strong}</strong>
        {callout.tail}
      </p>
    </div>
  );
}

export function GuideSection({ section }: { readonly section: GuideSectionData }) {
  return (
    <section
      id={section.id}
      aria-labelledby={section.headingId}
      data-guide-section={section.id}
      className="flex scroll-mt-24 flex-col gap-4 border-t border-border pt-8"
    >
      <span className="text-[13px] font-semibold text-brand-accent-text">{section.index}</span>
      <h2
        id={section.headingId}
        className="m-0 text-[clamp(26px,3.2vw,30px)] leading-[1.2] font-bold tracking-[-0.02em]"
      >
        {section.title}
      </h2>
      {section.body ? (
        <p className="m-0 text-[17px] leading-[1.6] text-pretty text-text-secondary">{section.body}</p>
      ) : null}
      {section.items ? <ItemList items={section.items} sectionId={section.id} /> : null}
      {section.cards ? <CardGrid cards={section.cards} /> : null}
      {section.terms ? <TermList terms={section.terms} glossary={section.id === "glosario"} /> : null}
      {section.bands ? <BandRow bands={section.bands} /> : null}
      {section.states ? <StateGrid states={section.states} /> : null}
      {section.outcomes ? <OutcomeCards outcomes={section.outcomes} /> : null}
      {section.callout ? <Callout callout={section.callout} /> : null}
      {section.valuedTitle && section.valued ? (
        <div className="mt-4 flex flex-col gap-4">
          <h3 className="m-0 text-[20px] font-bold">{section.valuedTitle}</h3>
          <CardGrid cards={section.valued} />
        </div>
      ) : null}
      {section.workedExample ? <WorkedExample example={section.workedExample} /> : null}
    </section>
  );
}
