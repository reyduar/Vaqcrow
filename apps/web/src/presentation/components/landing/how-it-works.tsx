import type { IconType } from "react-icons";
import { IoAnalyticsOutline, IoCubeOutline, IoDocumentTextOutline, IoReceiptOutline } from "react-icons/io5";

/**
 * 「Cómo funciona」 (`Vaqcrow Landing.dc.html` lines 187–204, WU1): the heading,
 * its subtitle and the four numbered steps, verbatim from the template's
 * `steps` data (lines 320–325). The anchor `#como-funciona` is the Spanish
 * in-page target the header links to (owner decision, 2026-10-10).
 */
const STEPS: readonly { readonly n: string; readonly icon: IconType; readonly title: string; readonly body: string }[] =
  [
    {
      n: "01",
      icon: IoDocumentTextOutline,
      title: "La PyME presenta evidencia",
      body: "Perfil, KYC y ventas mensuales. Cada dato declara su origen; en esta demo, todos son sintéticos."
    },
    {
      n: "02",
      icon: IoAnalyticsOutline,
      title: "La IA ordena; una persona decide",
      body: "La IA marca anomalías y faltantes y propone una evaluación. La aprobación la registra una persona, con nombre y fecha."
    },
    {
      n: "03",
      icon: IoCubeOutline,
      title: "Los aportes van a una bóveda",
      body: "Un contrato custodia los fondos. Si se alcanza la meta, paga a la PyME; si vence sin alcanzarla, habilita el reembolso."
    },
    {
      n: "04",
      icon: IoReceiptOutline,
      title: "La distribución se calcula y se firma",
      body: "Un cálculo determinístico sobre las ventas del período, con regla versionada. La PyME firma en Freighter."
    }
  ];

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="how-t"
      className="mx-auto flex w-full max-w-[1264px] flex-col gap-12 px-8 py-24"
    >
      <div
        className="grid items-end gap-x-16 gap-y-6"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}
      >
        <h2 id="how-t" className="m-0 text-[40px] leading-[1.15] font-bold tracking-[-0.025em] text-balance">
          Cómo funciona
        </h2>
        <p className="m-0 max-w-[56ch] text-[18px] leading-[1.55] text-pretty text-text-secondary">
          Cuatro pasos, cada uno con evidencia visible. Ningún paso depende de confiar en una persona para mover el
          dinero.
        </p>
      </div>

      <ol
        className="m-0 grid list-none gap-0 border-t border-border p-0"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))" }}
      >
        {STEPS.map(({ n, icon: Icon, title, body }) => (
          <li key={n} className="flex flex-col gap-3 pt-7 pr-6 pb-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-text-secondary">{n}</span>
              <Icon aria-hidden="true" focusable="false" className="text-[22px]" />
            </div>
            <h3 className="m-0 text-[20px] leading-[1.3] font-bold">{title}</h3>
            <p className="m-0 text-[15px] leading-normal text-pretty text-text-secondary">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
