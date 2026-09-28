/**
 * Organisation roles and what each may do. This is the single source of truth for
 * app-level authorisation; every org-scoped route checks `can(role, capability)`.
 *
 *   owner  — billing/settings, manage members, everything an admin can do
 *   admin  — manage members, boards and all images
 *   editor — upload, edit metadata, create/edit boards, share
 *   viewer — browse, download and resize only
 */
export const ROLES = ["owner", "admin", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

/** Roles that may be granted through an invite or role change (ownership is transferred, not invited). */
export const ASSIGNABLE_ROLES = ["admin", "editor", "viewer"] as const satisfies readonly Role[];

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };

const MIN_ROLE = {
  // Library
  "image:view": "viewer",
  "image:download": "viewer",
  "image:resize": "viewer",
  "image:upload": "editor",
  "image:edit": "editor",
  /** Trash images you uploaded yourself. */
  "image:delete:own": "editor",
  /** Trash anyone's images; restore or permanently delete from Trash. */
  "image:delete:any": "admin",
  // Boards
  "board:view": "viewer",
  "board:edit": "editor",
  "board:delete:any": "admin",
  // Sharing
  "share:create": "editor",
  "share:manage:any": "admin",
  // Organisation
  "member:view": "viewer",
  "member:manage": "admin",
  "preset:manage": "admin",
  "audit:view": "admin",
  "org:settings": "owner",
  "org:delete": "owner",
} as const satisfies Record<string, Role>;

export type Capability = keyof typeof MIN_ROLE;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[MIN_ROLE[capability]];
}

/** True if `actor` may assign `target` to someone (only owners can grant/revoke ownership). */
export function canAssignRole(actor: Role, target: Role): boolean {
  if (!can(actor, "member:manage")) return false;
  return target === "owner" ? actor === "owner" : true;
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Billing and settings, plus everything an admin can do",
  admin: "Manage members, boards and all images",
  editor: "Upload, edit metadata, create boards and share",
  viewer: "Browse, download and resize only",
};
