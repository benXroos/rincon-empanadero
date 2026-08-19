"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/core/auth/auth";

/**
 * Server action backing the login form (Phase 4, task 4.2). No public
 * signup form exists — design decision #4's rationale is that accounts are
 * admin-provisioned (see `scripts/seed-admin.ts`) — so this action only
 * ever authenticates an existing `users` row via the Credentials provider.
 *
 * Follows Auth.js's own documented try/catch pattern: `signIn()` throws an
 * `AuthError` subclass (e.g. `CredentialsSignin`) on bad credentials, and
 * otherwise redirects internally on success by throwing Next.js's own
 * internal redirect signal — which is NOT an `AuthError`, so it is
 * deliberately re-thrown unchanged here rather than swallowed.
 */
export async function authenticate(
  _previousError: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: String(formData.get("callbackUrl") ?? "/admin/catalog"),
    });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      return "Email o contraseña incorrectos.";
    }
    throw error;
  }
}
