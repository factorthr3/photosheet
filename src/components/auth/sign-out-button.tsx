"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/client";

export function SignOutButton({ redirectTo = "/login" }: { redirectTo?: string }) {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await signOut();
        router.push(redirectTo);
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
