import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { users } from "@/infrastructure/db/schema";

/**
 * Auth.js Credentials skeleton (design decision #4).
 *
 * This wires the credentials provider and DB-session shape so later phases
 * can add the login page and `requireRole()` gate (Phase 4, access-control)
 * without re-plumbing auth infrastructure. No role-gated pages/UI exist yet.
 */
export const authConfig = {
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const [user] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);

        if (!user) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);

        if (!passwordMatches) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  /**
   * DEVIATION FROM DESIGN DECISION #4 (confirmed, not a leftover
   * placeholder): design decision #4 calls for a DB session strategy, but
   * Auth.js v5 hard-codes an incompatibility between the Credentials
   * provider and `strategy: "database"` when every configured provider is
   * `type: "credentials"` — see
   * `@auth/core`'s `lib/utils/assert.js`, which throws
   * `UnsupportedStrategy("Signing in with credentials only supported if
   * JWT strategy is enabled")` in exactly that case. This app has only the
   * Credentials provider, so `strategy: "database"` would make every
   * `auth()` call throw at request time. JWT is therefore the only valid
   * strategy here, not an unfixed Phase 1 deferral — see
   * `sdd/rincon-empanadero-management-app/apply-progress` (Phase 4 batch)
   * for the verification trail.
   */
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        // `token.role` augmentation (see ./types.d.ts) does not always merge
        // cleanly across next-auth's beta JWT re-export; cast with a safe
        // fallback rather than fight the beta type surface here.
        session.user.role = (token.role as "admin" | "colaborador" | undefined) ?? "colaborador";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
