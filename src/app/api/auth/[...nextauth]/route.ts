/**
 * @nicheapps-scaffold-v2
 *
 * Auth.js v5 handlers mounted at /api/auth/*.
 *
 * Imports the FULL config from /auth.ts — that includes the jwt
 * callback (and Firebase Admin if uses_firebase is on). API route
 * handlers run in Node runtime by default, so importing
 * ``firebase-admin`` here is fine.
 *
 * Auth.js v5 returns a ``handlers`` object with ``GET`` / ``POST``
 * properties; we destructure here rather than in auth.ts so the
 * route file is fully self-contained.
 */
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
