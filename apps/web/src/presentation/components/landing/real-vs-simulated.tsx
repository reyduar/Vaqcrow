import { IoCheckmarkOutline, IoFlaskOutline, IoGitNetworkOutline, IoRemoveOutline } from "react-icons/io5";
import { CanonicalDisclosure } from "../canonical-disclosure";

/**
 * 「Qué es real y qué es simulado」 (`Vaqcrow Landing.dc.html` lines 206–235,
 * WU1): the bound section under `#limites` with the two cards. Both callouts
 * are the canonical disclosures — the real card's is `testnet`, the synthetic
 * card's is `simulation` — rendered only through `CanonicalDisclosure`, never
 * retyped (owner decision Q3, 2026-10-10).
 */
const REAL_ITEMS: readonly string[] = [
  "El contrato de la bóveda en Stellar (Soroban)",
  "La firma de cada transacción con Freighter",
  "Los hashes, verificables en el explorador",
  "La evaluación de IA explicable y la decisión humana registrada"
];

const SIMULATED_ITEMS: readonly string[] = [
  "La identidad y el KYC/KYB de cada PyME",
  "Las ventas mensuales declaradas",
  "La conversión entre ARS y el activo de Stellar",
  "Las PyMEs del marketplace"
];

export function RealVsSimulated() {
  return (
    <section id="limites" aria-labelledby="lim-t" className="border-y border-border bg-page-surface">
      <div className="mx-auto flex w-full max-w-[1264px] flex-col gap-10 px-8 py-24">
        <div className="flex max-w-[720px] flex-col gap-3">
          <h2 id="lim-t" className="m-0 text-[40px] leading-[1.15] font-bold tracking-[-0.025em]">
            Qué es real y qué es simulado
          </h2>
          <p className="m-0 text-[18px] leading-[1.55] text-text-secondary">
            Vaqcrow es una demo construida como Trabajo Fin de Máster. La tecnología funciona; los datos y el dinero no
            son reales.
          </p>
        </div>

        <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}>
          <div className="flex flex-col gap-4 rounded-card border border-border bg-canvas p-7">
            <div className="flex items-center gap-2.5">
              <IoGitNetworkOutline aria-hidden="true" focusable="false" className="text-[22px] text-brand-accent-text" />
              <h3 className="m-0 text-[20px] font-bold">Se ejecuta de verdad, en Testnet</h3>
            </div>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[15px]">
              {REAL_ITEMS.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <IoCheckmarkOutline aria-hidden="true" focusable="false" className="mt-0.5 text-[18px]" />
                  {item}
                </li>
              ))}
            </ul>
            <CanonicalDisclosure id="testnet" />
          </div>

          <div className="flex flex-col gap-4 rounded-card border border-dashed border-control bg-canvas p-7">
            <div className="flex items-center gap-2.5">
              <IoFlaskOutline aria-hidden="true" focusable="false" className="text-[22px]" />
              <h3 className="m-0 text-[20px] font-bold">Es sintético</h3>
            </div>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[15px]">
              {SIMULATED_ITEMS.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <IoRemoveOutline aria-hidden="true" focusable="false" className="mt-0.5 text-[18px]" />
                  {item}
                </li>
              ))}
            </ul>
            <CanonicalDisclosure id="simulation" />
          </div>
        </div>
      </div>
    </section>
  );
}
