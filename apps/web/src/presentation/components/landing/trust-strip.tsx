import type { IconType } from "react-icons";
import { IoCubeOutline, IoGitNetworkOutline, IoKeyOutline, IoPersonOutline } from "react-icons/io5";

/**
 * The trust strip (`Vaqcrow Landing.dc.html` lines 138–145, WU1): four
 * technical guarantees of the demo, verbatim, on the surface band between the
 * hero and «Cómo funciona».
 */
const GUARANTEES: readonly { readonly icon: IconType; readonly label: string }[] = [
  { icon: IoGitNetworkOutline, label: "Stellar Testnet · activos sin valor económico" },
  { icon: IoCubeOutline, label: "Aportes custodiados por contrato, no por personas" },
  { icon: IoKeyOutline, label: "Firma no custodial con Freighter" },
  { icon: IoPersonOutline, label: "La IA recomienda; una persona decide" }
];

export function TrustStrip() {
  return (
    <section aria-label="Garantías técnicas de la demo" className="border-y border-border bg-page-surface">
      <ul
        className="mx-auto grid w-full max-w-[1264px] list-none gap-x-8 gap-y-4 px-8 py-6"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}
      >
        {GUARANTEES.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-2.5 text-sm font-medium">
            <Icon aria-hidden="true" focusable="false" className="shrink-0 text-[20px] text-brand-accent-text" />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
