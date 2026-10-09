import { AppShell } from "@/presentation/components/app-shell";
import { CampaignDetailContainer } from "@/presentation/components/campaign-detail/campaign-detail";

/**
 * `/campaigns/[id]` — the campaign detail (Feature #422, WU2). The route is
 * public; the gate lives in the client container, which renders the template's
 * logged-out card with no fetch until there is a session. WU1's
 * `GET /marketplace/campaigns/:campaignId` is the only data source.
 */
export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell>
      <CampaignDetailContainer campaignId={id} />
    </AppShell>
  );
}
