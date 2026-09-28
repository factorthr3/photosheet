import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const email = typeof sp.email === "string" ? sp.email : "";
  const notice = sp.reset ? "Password updated. Log in with your new password." : null;
  return <LoginForm next={safeNext(sp.next)} defaultEmail={email} notice={notice} />;
}
