import { LoginForm } from "@/app/login/login-form";

/**
 * Login page (Phase 4, task 4.2). No public signup exists here or
 * anywhere in this app — design decision #4's rationale is that admin
 * provisions every account (see `scripts/seed-admin.ts`) — this page only
 * authenticates an existing user.
 *
 * `callbackUrl` is read server-side from the `searchParams` prop (Next.js
 * 15 App Router) rather than via `useSearchParams()` in a client component,
 * which avoids the Suspense-boundary requirement that hook otherwise needs.
 * Both `src/middleware.ts` (edge nicety) and `src/app/admin/layout.tsx`
 * (the real server-side gate) redirect here with `?callbackUrl=...` set to
 * the page the visitor originally tried to reach.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <main>
      <h1>Ingresar</h1>
      <LoginForm callbackUrl={callbackUrl ?? "/admin/catalog"} />
    </main>
  );
}
