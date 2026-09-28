import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

/** The current Better Auth session (deduplicated per request). */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Session or redirect to /login, preserving where the user was going. */
export async function requireSession(next?: string) {
  const session = await getSession();
  if (!session) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return session;
}
