import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Link2Off, Lock } from "lucide-react";
import { Logo } from "@/components/logo";
import { SharePasswordForm } from "@/components/share/share-password-form";
import { PublicShareView } from "@/components/share/public-share-view";
import { listShareImages, shareVariants } from "@/lib/public-share";
import { findShareByToken, isUnlocked, shareState, unlockCookieName } from "@/lib/shares";

export async function generateMetadata(props: PageProps<"/s/[token]">): Promise<Metadata> {
  const { token } = await props.params;
  const link = await findShareByToken(token);
  const locked = !link || !!link.passwordHash;
  const title = locked
    ? "Shared photos"
    : link.title ||
      link.board?.name ||
      link.image?.title ||
      link.image?.filename ||
      "Shared photos";
  // Never index share links.
  return { title, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-muted/40 px-4 py-16 text-center">
      <Logo className="mb-10" />
      {children}
    </div>
  );
}

export default async function SharePage(props: PageProps<"/s/[token]">) {
  const { token } = await props.params;
  const link = await findShareByToken(token);

  if (!link || shareState(link) !== "active") {
    return (
      <Shell>
        <Link2Off className="mb-4 size-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold">This link is no longer available</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          It may have expired or been turned off. Ask the person who shared it for a new link.
        </p>
      </Shell>
    );
  }

  const cookie = (await cookies()).get(unlockCookieName(link.id))?.value;
  if (!isUnlocked(link, cookie)) {
    return (
      <Shell>
        <Lock className="mb-4 size-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold">{link.org.name} shared photos with you</h1>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">Enter the password to view them.</p>
        <SharePasswordForm token={token} />
      </Shell>
    );
  }

  const [page, variants] = await Promise.all([listShareImages(link, null), shareVariants(link)]);
  return (
    <PublicShareView
      token={token}
      orgName={link.org.name}
      title={
        link.title ||
        link.board?.name ||
        link.image?.title ||
        link.image?.filename ||
        "Shared photos"
      }
      message={link.message}
      description={link.targetType === "board" ? (link.board?.description ?? null) : null}
      isBoard={link.targetType === "board"}
      expiresAt={link.expiresAt?.toISOString() ?? null}
      variants={variants.map(({ id, label, detail }) => ({ id, label, detail }))}
      initial={page}
    />
  );
}
