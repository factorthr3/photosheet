import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInvitation } from "@/components/org/accept-invitation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { ROLE_LABELS, isRole } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Invitation" };

export default async function InvitePage(props: PageProps<"/invite/[id]">) {
  const { id } = await props.params;
  const [invitation, session] = await Promise.all([
    prisma.invitation.findUnique({
      where: { id },
      include: {
        organization: { select: { name: true, slug: true } },
        user: { select: { name: true, email: true } },
      },
    }),
    getSession(),
  ]);

  const valid = invitation && invitation.status === "pending" && invitation.expiresAt > new Date();
  const next = `/invite/${id}`;

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <Logo className="mb-8" />
      <Card className="w-full max-w-sm">
        {!valid ? (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Invitation unavailable</CardTitle>
              <CardDescription>
                {invitation?.status === "accepted"
                  ? "This invitation has already been accepted."
                  : "This invitation is invalid, expired or was cancelled. Ask for a new one."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href={session ? "/app" : "/login"}>
                  {session ? "Go to PhotoSheet" : "Log in"}
                </Link>
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Join {invitation.organization.name}</CardTitle>
              <CardDescription>
                {invitation.user.name || invitation.user.email} invited{" "}
                <strong>{invitation.email}</strong> to join as{" "}
                {isRole(invitation.role)
                  ? ROLE_LABELS[invitation.role].toLowerCase()
                  : invitation.role}
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {!session ? (
                <>
                  <Button asChild>
                    <Link
                      href={`/signup?next=${encodeURIComponent(next)}&email=${encodeURIComponent(invitation.email)}`}
                    >
                      Create an account to accept
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link
                      href={`/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(invitation.email)}`}
                    >
                      I already have an account
                    </Link>
                  </Button>
                </>
              ) : session.user.email.toLowerCase() !== invitation.email.toLowerCase() ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    You&apos;re signed in as <strong>{session.user.email}</strong>. Sign in as{" "}
                    <strong>{invitation.email}</strong> to accept this invitation.
                  </p>
                  <SignOutButton
                    redirectTo={`/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(invitation.email)}`}
                  />
                </>
              ) : (
                <AcceptInvitation
                  invitationId={invitation.id}
                  orgSlug={invitation.organization.slug}
                />
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
