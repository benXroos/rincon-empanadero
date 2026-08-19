import NextAuth from "next-auth";

/**
 * Phase 4 (access-control), task 4.1: edge-level redirect-to-login for
 * unauthenticated `/admin/*` requests. Design decision #5 is explicit that
 * middleware alone is NOT a sufficient authorization gate — the real gate
 * is `src/app/admin/layout.tsx`'s `requireSession()`, which still runs
 * server-side on every request regardless of this file. This middleware
 * exists only so an unauthenticated visitor gets redirected before a full
 * page render, which is a UX nicety, not the security boundary.
 *
 * Deliberately builds its OWN provider-less NextAuth instance instead of
 * importing the real `authConfig` from `src/core/auth/auth.config.ts`:
 * that config's Credentials provider `authorize` callback pulls in bcrypt
 * and the Drizzle/Neon client, which would otherwise get bundled into the
 * Edge Runtime for no benefit — middleware never triggers `authorize()`
 * (only a real sign-in POST to the Node.js route handler does). Both
 * instances default to the same JWT strategy and read the same
 * `AUTH_SECRET`, so this instance correctly decodes the session cookie the
 * real config issues.
 */
const { auth } = NextAuth({
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth: session, request }) {
      if (!request.nextUrl.pathname.startsWith("/admin")) {
        return true;
      }
      return Boolean(session?.user);
    },
  },
});

export default auth;

export const config = {
  matcher: ["/admin/:path*"],
};
