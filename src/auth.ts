/**
 * @nicheapps-scaffold-v2
 *
 * NicheApps SSO via OpenID Connect — full Auth.js v5 config.
 *
 * Imports the Edge-safe provider list from ``auth.config.ts`` and
 * adds Node-only callbacks. Only the API route handler imports this
 * file; ``middleware.ts`` imports ``auth.config.ts`` directly so
 * its Edge bundle stays Node-API-free.
 *
 * The platform issues NICHE_CLIENT_SECRET / NICHE_CLIENT_ID /
 * NICHE_ISSUER as runtime env variables when this app is deployed
 * through NicheApps. For local development copy them into .env.local.
 */
import NextAuth from "next-auth";
import authConfig from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      (session as { accessToken?: string }).accessToken =
        token.accessToken as string | undefined;
      return session;
    },
  },
});
