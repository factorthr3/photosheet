"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SharePasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="grid w-full max-w-xs gap-3 text-left"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const res = await fetch(`/api/s/${token}/unlock`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (res.ok) {
          router.refresh();
          return;
        }
        setError((await res.json().catch(() => ({}))).error ?? "Couldn't unlock");
        setPending(false);
      }}
    >
      <Label htmlFor="share-password">Password</Label>
      <Input
        id="share-password"
        type="password"
        autoFocus
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <FormError message={error} />
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        View photos
      </Button>
    </form>
  );
}
