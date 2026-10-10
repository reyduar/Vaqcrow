import { EvidenceView } from "@/presentation/components/admin/evidence-view";

/**
 * `/admin/pymes/[applicationId]/evidence`: the Testnet evidence chain of one
 * application (#438 WU4), inside the console shell and guard. The id is
 * validated by the gateway: an id the API would never accept renders the
 * not-found state.
 */
export default async function AdminEvidencePage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  return <EvidenceView applicationId={applicationId} />;
}
