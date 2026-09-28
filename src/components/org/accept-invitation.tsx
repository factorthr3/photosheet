"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function AcceptInvitation({
  invitationId,
  orgSlug,
}: {
  invitationId: string;
  orgSlug: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setPending("accept");
    setError(null);
    const { data, error } = await authClient.organization.acceptInvitation({ invitationId });
    if (error) {
      setError(error.message ?? "Could not accept invitation");
      setPending(null);
      return;
    }
    if (data?.member?.organizationId) {
      await authClient.organization.setActive({ organizationId: data.member.organizationId });
    }
    router.push(`/o/${orgSlug}`);
    router.refresh();
  }

  async function reject() {
    setPending("reject");
    setError(null);
    const { error } = await authClient.organization.rejectInvitation({ invitationId });
    if (error) {
      setError(error.message ?? "Could not decline invitation");
      setPending(null);
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      <FormError message={error} />
      <Button onClick={accept} disabled={pending !== null}>
        {pending === "accept" && <Loader2 className="animate-spin" />}
        Accept invitation
      </Button>
      <Button variant="ghost" onClick={reject} disabled={pending !== null}>
        {pending === "reject" && <Loader2 className="animate-spin" />}
        Decline
      </Button>
    </div>
  );
}
