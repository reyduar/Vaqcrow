import { PortfolioContainer } from "@/presentation/components/portfolio/portfolio";

/**
 * `/portfolio`: the investor portfolio (Feature #426, WU2). The route is already
 * `INVERSOR`-gated by `(app)/layout.tsx` + `RouteGate`; the container owns the
 * title, the wallet card and the sections.
 */
export default function PortfolioPage() {
  return <PortfolioContainer />;
}
