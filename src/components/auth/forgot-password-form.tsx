"use client";

import { Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setPending(false);
    if (error) {
      setError(
        error.status === 429
          ? "Too many requests. Try again in a minute."
          : (error.message ?? "Something went wrong"),
      );
      return;
    }
    setSent(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>We&apos;ll email you a link to choose a new one.</CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="grid gap-2 text-center" role="status">
            <Mail className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              If an account exists for <strong>{email}</strong>, a reset link is on its way.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <FormError message={error} />
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Send reset link
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-muted-foreground underline-offset-4 hover:underline">
            Back to log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
