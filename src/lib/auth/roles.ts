import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

/**
 * Better Auth access control for its organisation endpoints (invites, member changes).
 * App-level permissions (images, boards, shares) live in `@/lib/permissions`.
 * Safe to import from client code.
 */
export const ac = createAccessControl(defaultStatements);

export const owner = ac.newRole({
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
});

export const admin = ac.newRole({
  organization: [],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
});

export const editor = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
});

export const viewer = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
});

export const roles = { owner, admin, editor, viewer };
