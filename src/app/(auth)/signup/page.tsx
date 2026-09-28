import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage(props: PageProps<"/signup">) {
  const sp = await props.searchParams;
  const email = typeof sp.email === "string" ? sp.email : "";
  return <SignupForm next={safeNext(sp.next)} defaultEmail={email} />;
}
