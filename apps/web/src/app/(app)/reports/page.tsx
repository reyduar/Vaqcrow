import { ReportsContainer } from "@/presentation/components/reports/reports";

/**
 * `/reports`: the investor report (Feature #430, WU2). The route is gated by
 * `(app)/layout.tsx` + `RouteGate` (all authenticated roles, WU4); the container
 * owns the title ("Informes"), the subtitle and the sections.
 */
export default function ReportsPage() {
  return <ReportsContainer />;
}
