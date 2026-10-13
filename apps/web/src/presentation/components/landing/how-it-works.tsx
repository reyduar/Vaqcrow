import type { IconType } from "react-icons";
import {
  IoAnalyticsOutline,
  IoArrowForwardCircleOutline,
  IoCheckmarkCircleOutline,
  IoCubeOutline,
  IoDocumentTextOutline,
  IoEllipseOutline,
  IoGlobeOutline,
  IoHelpCircleOutline,
  IoPersonAddOutline,
  IoPersonCircleOutline,
  IoReceiptOutline,
  IoReturnDownBackOutline,
  IoWalletOutline
} from "react-icons/io5";
import { HOW_IT_WORKS_GUIDE, readGuideSource } from "@/infrastructure/guides/read-guide-source";
import { HOW_IT_WORKS_KINDS, parseHowItWorks } from "@/application/landing/how-it-works";
import { Badge, type BadgeVariant } from "../badge";
import { RevealOnScroll } from "./reveal-on-scroll";

/**
 * 「La traza」 — the landing's 「Cómo funciona」 section (#497), replacing the
 * template's four steps (owner decision, 2026-10-13: the template's explanation
 * was too thin to explain the operation).
 *
 * It is **one continuous trace** of a whole campaign, from the PyME's account to
 * the monthly revenue share. At the vault the trace forks, because the
 * All-or-Nothing rule is where the path really splits in two. Each stage
 * declares what it leaves behind, so the trace doubles as the trust map
 * `docs/design/demo-ui.md` §2 requires, instead of a footnote under it.
 *
 * The words come from `docs/guides/como-funciona-vaqcrow.md`, read at build time
 * (owner decision, option A). What lives here is presentation only: the icon and
 * the trust badge of each stage. Order ties them to the document, and
 * `how-it-works.test.tsx` pins the titles, the kinds and the badges so a
 * reordered document fails in CI instead of rendering the wrong badge.
 */

interface StageMark {
  readonly variant: BadgeVariant;
  readonly label: string;
}

interface StageMeta {
  readonly icon: IconType;
  readonly mark: StageMark;
}

/** One entry per `##` section of the guide, in the same order. */
const STAGE_META: readonly StageMeta[] = Object.freeze([
  { icon: IoPersonAddOutline, mark: { variant: "simulado", label: "KYC simulado" } },
  { icon: IoDocumentTextOutline, mark: { variant: "evidence", label: "se suben de verdad" } },
  { icon: IoAnalyticsOutline, mark: { variant: "evidence", label: "asesora, no decide" } },
  { icon: IoWalletOutline, mark: { variant: "transaction", label: "no custodial" } },
  { icon: IoPersonCircleOutline, mark: { variant: "evidence", label: "con nombre, razón y fecha" } },
  { icon: IoCubeOutline, mark: { variant: "testnet", label: "contrato en Testnet" } },
  { icon: IoGlobeOutline, mark: { variant: "evidence", label: "pública y compartible" } },
  { icon: IoPersonAddOutline, mark: { variant: "simulado", label: "KYC simulado" } },
  { icon: IoArrowForwardCircleOutline, mark: { variant: "transaction", label: "lo firma el inversor" } },
  { icon: IoHelpCircleOutline, mark: { variant: "testnet", label: "lo aplica el contrato" } },
  { icon: IoCheckmarkCircleOutline, mark: { variant: "evidence", label: "liquidación atómica" } },
  { icon: IoReturnDownBackOutline, mark: { variant: "evidence", label: "reembolso habilitado" } },
  { icon: IoReceiptOutline, mark: { variant: "simulado", label: "ventas simuladas" } }
]);

const RAIL =
  "pointer-events-none absolute left-5 top-0 h-full w-px origin-top bg-border group-data-[revealed=true]/traza:animate-traza motion-reduce:animate-none";

const MARKER =
  "absolute left-0 top-0 grid size-10 place-items-center rounded-full border border-border bg-canvas text-[18px] text-text-secondary";

const FORK_MARKER =
  "absolute left-0 top-0 grid size-10 place-items-center rounded-full border border-brand-accent bg-brand-accent-tint text-[18px] text-brand-accent-text";

interface Stage {
  readonly station: { readonly title: string; readonly body: readonly string[] };
  readonly metaIndex: number;
}

function StageParagraphs({ paragraphs }: { readonly paragraphs: readonly string[] }) {
  return (
    <>
      {paragraphs.map((text) => (
        <p key={text} className="m-0 max-w-[68ch] text-[15px] leading-[1.6] text-pretty text-text-secondary">
          {text}
        </p>
      ))}
    </>
  );
}

export function HowItWorks() {
  const { lead, stations } = parseHowItWorks(readGuideSource(HOW_IT_WORKS_GUIDE));

  const forkAt = HOW_IT_WORKS_KINDS.indexOf("fork");
  const before: readonly Stage[] = stations
    .slice(0, forkAt)
    .map((station, index) => ({ station, metaIndex: index }));
  const fork: Stage | undefined =
    forkAt === -1 ? undefined : { station: stations[forkAt]!, metaIndex: forkAt };
  const tail: readonly Stage[] = stations
    .slice(forkAt + 1)
    .map((station, index) => ({ station, metaIndex: forkAt + 1 + index }));
  const branches = tail.filter((stage) => HOW_IT_WORKS_KINDS[stage.metaIndex] === "branch");
  const after = tail.filter((stage) => HOW_IT_WORKS_KINDS[stage.metaIndex] !== "branch");

  // Linear stages are numbered in render order; the two branches are not numbered.
  const stageNumber = new Map(
    stations
      .map((_, index) => index)
      .filter((index) => HOW_IT_WORKS_KINDS[index] !== "branch")
      .map((index, position) => [index, String(position + 1).padStart(2, "0")])
  );

  function renderStage({ station, metaIndex }: Stage) {
    const meta = STAGE_META[metaIndex];
    const Icon = meta?.icon ?? IoEllipseOutline;

    return (
      <li key={station.title} className="relative flex flex-col gap-3 pl-14">
        <span aria-hidden="true" className={MARKER}>
          <Icon focusable="false" />
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[13px] font-semibold tabular-nums text-text-secondary">
            {stageNumber.get(metaIndex)}
          </span>
          <h3 className="m-0 text-[19px] leading-[1.3] font-bold">{station.title}</h3>
          {meta ? <Badge variant={meta.mark.variant} label={meta.mark.label} /> : null}
        </div>
        <StageParagraphs paragraphs={station.body} />
      </li>
    );
  }

  const forkMeta = fork === undefined ? undefined : STAGE_META[fork.metaIndex];
  const ForkIcon = forkMeta?.icon ?? IoHelpCircleOutline;

  return (
    <section id="como-funciona" aria-labelledby="how-t" className="border-t border-border">
      <div className="mx-auto flex w-full max-w-[1264px] flex-col gap-14 px-8 py-24">
        <div className="flex max-w-[760px] flex-col gap-4">
          <h2 id="how-t" className="m-0 text-[40px] leading-[1.15] font-bold tracking-[-0.025em] text-balance">
            Cómo funciona
          </h2>
          {lead.map((text) => (
            <p key={text} className="m-0 text-[17px] leading-[1.6] text-pretty text-text-secondary">
              {text}
            </p>
          ))}
        </div>

        <RevealOnScroll>
          <ol className="relative m-0 flex list-none flex-col gap-9 p-0">
            <span aria-hidden="true" className={RAIL} />

            {before.map(renderStage)}

            {fork === undefined ? null : (
              <li key={fork.station.title} className="relative flex flex-col gap-4 pl-14">
                <span aria-hidden="true" className={FORK_MARKER}>
                  <ForkIcon focusable="false" />
                </span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h3 className="m-0 text-[19px] leading-[1.3] font-bold">{fork.station.title}</h3>
                  {forkMeta ? <Badge variant={forkMeta.mark.variant} label={forkMeta.mark.label} /> : null}
                </div>
                <StageParagraphs paragraphs={fork.station.body} />

                <ol className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
                  {branches.map(({ station, metaIndex }) => {
                    const meta = STAGE_META[metaIndex];
                    const Icon = meta?.icon ?? IoEllipseOutline;

                    return (
                      <li key={station.title} className="flex flex-col gap-3 rounded-card border border-border bg-canvas p-5">
                        <div className="flex items-center gap-x-3">
                          <Icon aria-hidden="true" focusable="false" className="text-[18px] text-text-secondary" />
                          <h4 className="m-0 text-[17px] leading-[1.3] font-bold">{station.title}</h4>
                        </div>
                        {meta ? <Badge variant={meta.mark.variant} label={meta.mark.label} /> : null}
                        <StageParagraphs paragraphs={station.body} />
                      </li>
                    );
                  })}
                </ol>
              </li>
            )}

            {after.map(renderStage)}
          </ol>
        </RevealOnScroll>
      </div>
    </section>
  );
}
