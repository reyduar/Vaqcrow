import { AcceptInvitationScreen } from "@/presentation/components/accept-invitation-screen";

/**
 * `/accept-invitation`: the operator invitation acceptance (#390/WU5).
 *
 * This is the exact path the invite email's `redirectTo` points at
 * (`OPERATOR_INVITATION_ACCEPT_PATH` in the API), so the GoTrue link lands here
 * and the browser Supabase client picks the session up from the URL.
 */
export default function AcceptInvitationPage() {
  return <AcceptInvitationScreen />;
}
