"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type ActionResult, actionError } from "@/lib/action-result";
import { recordAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { requireOrg } from "@/lib/org";

export async function renameOrganization(slug: string, name: string): Promise<ActionResult> {
  try {
    const newName = z.string().trim().min(1, "Name is required").max(80).parse(name);
    const ctx = await requireOrg(slug, "org:settings");
    await auth.api.updateOrganization({
      headers: await headers(),
      body: { organizationId: ctx.org.id, data: { name: newName } },
    });
    await recordAudit({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      action: "org.update",
      targetType: "organization",
      targetId: ctx.org.id,
      meta: { from: ctx.org.name, to: newName },
    });
    revalidatePath(`/o/${slug}`, "layout");
    return { ok: true };
  } catch (err) {
    return actionError(err);
  }
}
