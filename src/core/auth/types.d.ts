import type { DefaultSession } from "next-auth";

/**
 * Extends Auth.js session/JWT types with our two-role model
 * (admin | colaborador) — see spec capability `access-control`.
 */
declare module "next-auth" {
  interface Session {
    user: {
      role: "admin" | "colaborador";
    } & DefaultSession["user"];
  }

  interface User {
    role: "admin" | "colaborador";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "admin" | "colaborador";
  }
}
