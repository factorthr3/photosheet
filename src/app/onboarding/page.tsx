import type { Metadata } from "next";
import Link from "next/link";
import { CreateOrgForm } from "@/components/org/create-org-form";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pendingInvitationsFor } from "@/lib/invitations";
import { ROLE_LABELS, isRole } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Create an organisation" };

export default async function OnboardingPage() {
  const session = await requireSession("/onboarding");
  const invitations = await pendingInvitationsFor(session.user.email);

  return (
    <div className="flex flex-1 flex-col items-center bg-muted/40 px-4 py-12">
      <Logo className="mb-8" />
      <div className="grid w-full max-w-md gap-6">
        {invitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">You&apos;ve been invited</CardTitle>
              <CardDescription>Join an existing organisation.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{inv.organization.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {isRole(inv.role) ? ROLE_LABELS[inv.role] : inv.role} · from{" "}
                      {inv.user.name || inv.user.email}
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/invite/${inv.id}`}>View</Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create an organisation</CardTitle>
            <CardDescription>
              An organisation holds your team&apos;s images and boards. You can invite colleagues
              next.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateOrgForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
