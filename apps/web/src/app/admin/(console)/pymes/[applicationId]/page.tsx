import { ApplicationReview } from "@/presentation/components/admin/application-review";

/**
 * `/admin/pymes/[applicationId]`: the review of one application (#410 / U2–U3),
 * inside the console shell and guard. The id is validated by the gateway: an
 * id the API would never accept renders the not-found state.
 */
export default async function AdminReviewPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  return <ApplicationReview applicationId={applicationId} />;
}
