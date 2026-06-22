import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/session";
import { firstAllowedPath } from "@/lib/user-permissions";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(firstAllowedPath(session.permissions));

  return (
    <main className="login-page">
      <LoginForm />
    </main>
  );
}
