"use client";

import { magicLinkClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ac, roles } from "./roles";

export const authClient = createAuthClient({
  plugins: [organizationClient({ ac, roles }), magicLinkClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
