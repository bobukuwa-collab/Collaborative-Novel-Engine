/**
 * @nicheapps-scaffold-v2
 *
 * Edge-safe Auth.js v5 configuration shared between ``middleware.ts``
 * (Edge Runtime) and ``auth.ts`` (Node runtime).
 *
 * Provider definitions only. NEVER import Node-only packages
 * (``firebase-admin``, ``fs``, etc.) here — Next.js bundles this
 * file for the Edge runtime when ``middleware.ts`` imports it, and
 * Edge Runtime crashes on Node APIs at module load.
 *
 * Auth.js v5 split-config pattern:
 *   - ``auth.config.ts``: providers (this file)
 *   - ``auth.ts``: ``NextAuth({...authConfig, callbacks})`` —
 *     callbacks may use Node-only APIs because only the API route
 *     handler imports auth.ts (route handlers default to Node).
 */
import type { NextAuthConfig } from "next-auth";

const authConfig = {
  providers: [
    {
      id: "nicheapps",
      name: "NicheApps",
      type: "oidc",
      issuer: process.env.NICHE_ISSUER!,
      clientId: process.env.NICHE_CLIENT_ID!,
      clientSecret: process.env.NICHE_CLIENT_SECRET!,
      authorization: {
        params: { scope: "openid email profile" },
      },
    },
  ],
} satisfies NextAuthConfig;

export default authConfig;
