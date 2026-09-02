# Code Review Rules — Rincón Empanadero Management App

Conventions already established in this codebase. Enforce these, don't invent new ones.

## Stack

- Next.js 15 (App Router, Turbopack), React 19, TypeScript 5 (`strict: true`).
- Drizzle ORM 0.45 + `@neondatabase/serverless` (HTTP driver, `drizzle-orm/neon-http`).
- next-auth (Auth.js) v5 beta for sessions.
- `decimal.js` for all money/percentage math — never raw floats.
- Vitest for unit/integration tests, Playwright for E2E.
- Package manager: pnpm (pinned via `packageManager` in `package.json`; use Corepack).

## Formatting & Linting

- Prettier is the source of truth: double quotes, semicolons, trailing commas everywhere (`all`), 100-char print width. Run `pnpm format` / `pnpm format:check`.
- ESLint config is `next/core-web-vitals` + `next/typescript` (flat config, `eslint.config.mjs`) — no custom rule overrides. Run `pnpm lint`.
- `pnpm typecheck` (`tsc --noEmit`) must pass with zero errors before any commit.
- Always import via the `@/*` path alias (`@/features/...`, `@/core/...`, `@/infrastructure/...`) — never relative `../../` chains across feature boundaries.

## Architecture: feature-first (screaming architecture)

Every capability lives under `src/features/<feature-name>/` with up to three subfolders, kept present via `.gitkeep` even before a file exists in them:

- `domain/` — pure business logic. **No I/O, no DB, no date/env access, no framework imports** (not even `next-auth` or `next/server`). Business rules and their provenance are documented inline.
- `application/` — one use case per file, verb-first name (`create-flavor.ts`, `register-sale.ts`, `toggle-availability.ts`). Composes `domain/` + `infrastructure/`, enforces authorization via `requireRole`/`requireSession` before any I/O.
- `infrastructure/` — repositories and framework/DB glue. Named exactly `<feature-name>.repository.ts` (e.g. `pricing-profile.repository.ts`). A repository may deliberately omit an operation (e.g. no `update`/`delete`) to enforce an append-only domain rule — document that intent as a comment.

A feature whose only job is to compose reads from other features' repositories (e.g. a dashboard) can have an empty `infrastructure/`.

Cross-cutting concerns (auth, DB client) live outside `features/`: `src/core/auth/`, `src/infrastructure/db/`.

## Naming

- kebab-case filenames, one exported concept per file.
- Unit tests are co-located next to their source file: `<name>.ts` + `<name>.test.ts` — never a separate `__tests__/` folder.
- Live-DB integration tests use the `<name>.integration.test.ts` suffix, distinct from plain `.test.ts`.
- Domain error types are `Error` subclasses named `<Concern>Error` (e.g. `PricingParamsError`, `UnauthorizedError`), setting `this.name` in the constructor.

## Domain layer rules

- Pure functions only: given the same input, same output, no side effects. No imports from `drizzle-orm`, `next-auth`, `next/*`, or anything reading `process.env`.
- All money/percentage values are `Decimal` (from `decimal.js`), constructed with `new Decimal(...)`; never mix in raw JS numbers for arithmetic. Reuse module-level constants (e.g. `const ONE = new Decimal(1)`) instead of re-instantiating.
- Rounding happens in exactly one place per calculation chain (e.g. `toDecimalPlaces(2, Decimal.ROUND_HALF_UP)`), documented as "the only place rounding happens" — everything upstream stays full precision.
- Guard clauses throw domain-specific errors synchronously; don't return sentinel values (`null`/`false`) for validation failures.

## Testing

- Import `describe`, `it`, `expect` from `"vitest"`.
- Pure `domain/` functions: assert exact values via golden fixtures (real business data, e.g. the owner's spreadsheet), asserted with `.toString()` on `Decimal` results. Add a negative test asserting the *wrong* formula would produce a different hardcoded value, to catch silent regressions.
- `application/` tests that depend on `requireRole` or a repository: declare mocks with `vi.hoisted(() => ({ ... }))` before `vi.mock(...)` calls (Vitest hoists `vi.mock`), mock the exact import path (`vi.mock("@/features/x/infrastructure/x.repository", () => ({ ... }))`), then `await import(...)` the system under test at module top-level, after the mocks. Reset mocks in `beforeEach` with `.mockReset()`.
- Prove authorization short-circuits: assert the repository mock was `not.toHaveBeenCalled()` when a role check should have denied access, in addition to asserting the thrown error.
- `require-role.server.ts` (touches real Next.js request context) is never unit-tested directly — mock it as a single dependency. `require-role.ts` (pure `assertRole`) carries the tested logic.
- Neon integration tests can be slow on a cold connection — this is expected, not a regression; `vitest.config.ts` sets `testTimeout: 30000` to absorb it.

## Data access (Drizzle + Neon)

- Get the DB handle via the shared lazy singleton `getDb()` from `@/infrastructure/db/client` — never construct a client at module scope (breaks builds without `DATABASE_URL`).
- Repository functions are thin async wrappers, one per DB operation, verb-first (`insertX`, `listXInRange`) — no business logic in `infrastructure/`.
- Use Drizzle's fluent query builder (`.select().from(...).where(eq(...)).orderBy(desc(...))`); no raw SQL unless there is no builder equivalent.

## Authorization

- `requireRole(allowedRoles: Role[])` (in `require-role.server.ts`) is called and `await`ed **before** any repository access inside a mutation — it throws `UnauthorizedError`, it never redirects.
- `requireSession()` is used in layouts/page views instead — it redirects to `/login` when there's no session, since a thrown error there would hit Next's generic error boundary.
- `Role` is `"admin" | "colaborador"`. Read-only admin pages are generally viewable by any authenticated session; mutations are the ones role-gated. Don't add a stricter gate than the spec calls for without checking existing sibling pages first.

## Server actions vs. direct calls

- **Reads**: call the application or repository function directly from an async Server Component — never wrap a read in `"use server"`.
- **Mutations**: mark the function `"use server"`, either at the top of the `application/*.ts` use-case file, or as an inline directive inside a page-local handler passed to `<form action={...}>`. A page-local handler should delegate immediately to the feature's `application/` function and then call `revalidatePath(...)` to refresh the read side.

## Commit messages

Conventional Commits, lowercase, imperative, no trailing period: `type(scope): description`.

- Types in use: `feat`, `fix`, `refactor`, `test`.
- Scope = the `src/features/<scope>` folder name (e.g. `metrics-dashboard`, `pricing`, `staff-attendance`), or `test` for cross-cutting test infrastructure. Omit the scope only for repo-wide changes.
