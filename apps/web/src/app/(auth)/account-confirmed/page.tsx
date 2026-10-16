import { confirmationFailed } from "@/application/auth/account-confirmed";
import { AccountConfirmedScreen } from "@/presentation/components/account-confirmed-screen";

/**
 * `/account-confirmed`: the sign-up email's `emailRedirectTo` (#556). Supabase
 * Auth has already confirmed the account when it redirects here; a failed
 * confirmation arrives with `error`/`error_code` and shows the failure copy.
 */
export default async function AccountConfirmedPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AccountConfirmedScreen failed={confirmationFailed(await searchParams)} />;
}
