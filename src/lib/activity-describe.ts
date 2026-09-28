/** Human-readable sentences for audit events (client-safe, pure). */

export interface ActivityEvent {
  action: string;
  targetType: string;
  targetId: string | null;
  meta: Record<string, unknown>;
}

const PLURALS: Record<string, string> = { person: "people" };

const n = (count: unknown, noun: string) => {
  const c = Number(count ?? 0);
  return `${c.toLocaleString()} ${c === 1 ? noun : (PLURALS[noun] ?? `${noun}s`)}`;
};

const q = (v: unknown) => (v ? `“${String(v)}”` : "");

export function describeEvent(e: ActivityEvent): string {
  const m = e.meta ?? {};
  switch (e.action) {
    case "org.create":
      return `created the organisation ${q(m.name)}`;
    case "org.update":
      return `renamed the organisation to ${q(m.to)}`;
    case "member.invite":
      return `invited ${m.email} as ${m.role}`;
    case "member.invite_cancel":
      return `cancelled the invitation for ${m.email}`;
    case "member.join":
      return `joined as ${m.role}`;
    case "member.role_change":
      return `changed ${m.email} from ${m.from} to ${m.to}`;
    case "member.remove":
      return `removed ${m.email}`;
    case "image.upload":
      return `uploaded ${q(m.filename)}`;
    case "image.update":
      return `edited details of an image`;
    case "image.bulk_update":
      return `edited details of ${n(m.count, "image")}`;
    case "image.trash":
      return m.count === 1 && Array.isArray(m.filenames)
        ? `moved ${q(m.filenames[0])} to trash`
        : `moved ${n(m.count, "image")} to trash`;
    case "image.restore":
      return `restored ${n(m.count, "image")} from trash`;
    case "image.purge":
      return `permanently deleted ${n(m.count, "image")}${m.reason ? ` (${m.reason})` : ""}`;
    case "image.download":
      return `${m.via === "share" ? "downloaded via a shared link" : "downloaded"} ${q(m.filename)}${m.variant ? ` (${m.variant})` : ""}`.trim();
    case "board.create":
      return `created the board ${q(m.name)}`;
    case "board.update":
      if (m.added) return `added ${n(m.added, "image")} to a board`;
      if (m.removed) return `removed ${n(m.removed, "image")} from a board`;
      return "updated a board";
    case "board.delete":
      return `deleted the board ${q(m.name)}`;
    case "board.share_internal":
      return `shared a board with ${Array.isArray(m.added) ? m.added.join(", ") : "colleagues"}`;
    case "share.create":
      return `created a public link${m.password ? " (password protected)" : ""}`;
    case "share.revoke":
      return "revoked a public link";
    case "share.email":
      return `emailed a public link to ${n(m.recipients, "person")}`;
    case "export.zip":
      return `${m.via === "share" ? "requested a ZIP via a shared link" : "downloaded a ZIP"} of ${n(m.images, "image")}${m.variant ? ` (${m.variant})` : ""}`;
    case "export.pdf":
      return `exported a contact sheet PDF of ${n(m.images, "image")}`;
    case "preset.create":
      return `added the resize preset ${q(m.name)}`;
    case "preset.update":
      return m.reset
        ? "reset resize presets to the defaults"
        : `edited the resize preset ${q(m.name)}`;
    case "preset.delete":
      return `deleted the resize preset ${q(m.name)}`;
    default:
      return e.action;
  }
}

export const ACTIVITY_GROUPS: Record<string, { label: string; prefixes: string[] }> = {
  images: {
    label: "Uploads & edits",
    prefixes: ["image.upload", "image.update", "image.bulk_update"],
  },
  deletes: {
    label: "Deletes",
    prefixes: ["image.trash", "image.restore", "image.purge", "board.delete"],
  },
  downloads: { label: "Downloads", prefixes: ["image.download", "export."] },
  sharing: { label: "Sharing", prefixes: ["share.", "board.share_internal"] },
  boards: { label: "Boards", prefixes: ["board."] },
  members: { label: "Members & settings", prefixes: ["member.", "org.", "preset."] },
};
