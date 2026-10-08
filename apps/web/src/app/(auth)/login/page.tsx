import { roleFromParam } from "@/application/auth/auth-form";
import { AuthScreen } from "@/presentation/components/auth-screen";

/** `?returnTo=` may repeat; the first value is the only one that counts. */
function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role, returnTo } = await searchParams;
  const returnToValue = single(returnTo);
  return (
    <AuthScreen
      mode="login"
      initialRole={roleFromParam(role)}
      {...(returnToValue !== undefined ? { returnTo: returnToValue } : {})}
    />
  );
}
