import { roleFromParam } from "@/application/auth/auth-form";
import { AuthScreen } from "@/presentation/components/auth-screen";

export default async function SignupPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role } = await searchParams;
  return <AuthScreen mode="signup" initialRole={roleFromParam(role)} />;
}
