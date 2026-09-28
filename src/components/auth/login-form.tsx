"use client";

import { Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signIn } from "@/lib/auth/client";

export function LoginForm({
  next,
  defaultEmail,
  notice,
}: {
  next: string;
  defaultEmail: string;
  notice?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await signIn.email({ email, password });
    if (error) {
      setError(
        error.status === 429
          ? "Too many attempts. Try again in a minute."
          : (error.message ?? "Invalid email or password"),
      );
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function onMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await signIn.magicLink({ email, callbackURL: next });
    setPending(false);
    if (error) {
      setError(
        error.status === 429
          ? "Too many requests. Try again in a minute."
          : (error.message ?? "Could not send link"),
      );
      return;
    }
    setLinkSent(true);
  }

  const signupHref = `/signup?next=${encodeURIComponent(next)}${email ? `&email=${encodeURIComponent(email)}` : ""}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Log in</CardTitle>
        <CardDescription>Welcome back to PhotoSheet.</CardDescription>
      </CardHeader>
      <CardContent>
        {notice && (
          <p role="status" className="mb-4 rounded-md bg-muted px-3 py-2 text-sm">
            {notice}
          </p>
        )}
        <Tabs defaultValue="password">
          <TabsList className="mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="magic">Email link</TabsTrigger>
          </TabsList>

          <TabsContent value="password">
            <form onSubmit={onPassword} className="grid gap-4">
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
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <FormError message={error} />
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Log in
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="magic">
            {linkSent ? (
              <div className="grid gap-2 text-center" role="status">
                <Mail className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
                <p className="font-medium">Check your email</p>
                <p className="text-sm text-muted-foreground">
                  We sent a sign-in link to <strong>{email}</strong>. It expires in 10 minutes.
                </p>
                <Button variant="ghost" size="sm" onClick={() => setLinkSent(false)}>
                  Use a different email
                </Button>
              </div>
            ) : (
              <form onSubmit={onMagicLink} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="magic-email">Email</Label>
                  <Input
                    id="magic-email"
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
                  Email me a sign-in link
                </Button>
              </form>
            )}
          </TabsContent>
        </Tabs>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to PhotoSheet?{" "}
          <Link
            href={signupHref}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
