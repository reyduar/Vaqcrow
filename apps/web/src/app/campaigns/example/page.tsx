import { AppShell } from "@/presentation/components/app-shell";
import { ExampleCampaignDetail } from "@/presentation/components/campaign-detail/example-campaign-detail";

/**
 * `/campaigns/example` — the synthetic campaign detail (Issue #481). It is
 * public and account-free: the shared `CampaignDetailView` renders a frozen
 * fixture and never touches the API or Stellar. The static `example` segment
 * wins over the dynamic `/campaigns/[id]`, so this route is served here.
 */
export default function ExampleCampaignPage() {
  return (
    <AppShell>
      <ExampleCampaignDetail />
    </AppShell>
  );
}
