# Rincón Empanadero — Management App

Next.js 15 (App Router, TypeScript) modular monolith. Feature-first structure, one folder per capability under `src/features/`. See `sdd/rincon-empanadero-management-app/design` (Engram) for the full architecture rationale.

## Getting Started

Requires Node 20+ and pnpm (via corepack). This repo pins the pnpm version in `package.json#packageManager`.

```bash
corepack enable
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Create a `.env.local` (never committed — see `.gitignore`) with:

| Variable       | Purpose                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL` | Postgres connection string. Target is Neon in production; any local/dev Postgres works too. Format: `postgresql://user:password@host/dbname?sslmode=require` |
| `AUTH_SECRET`  | Auth.js signing secret. Generate with `npx auth secret` or `openssl rand -base64 33`.                                                                        |
| `NEXTAUTH_URL` | Base URL for Auth.js callbacks in development, e.g. `http://localhost:3000`.                                                                                 |

No live Neon credentials exist yet — Phase 1 wires the Drizzle/Neon client and Auth.js Credentials skeleton against these env var names only.

## Scripts

| Command                             | What it does                                                       |
| ----------------------------------- | ------------------------------------------------------------------ |
| `pnpm dev`                          | Start the Next.js dev server (Turbopack)                           |
| `pnpm build` / `pnpm start`         | Production build / start                                           |
| `pnpm lint`                         | ESLint                                                             |
| `pnpm typecheck`                    | `tsc --noEmit`                                                     |
| `pnpm format` / `pnpm format:check` | Prettier write / check                                             |
| `pnpm test`                         | Vitest (unit)                                                      |
| `pnpm test:watch`                   | Vitest watch mode                                                  |
| `pnpm test:e2e`                     | Playwright (E2E)                                                   |
| `pnpm db:generate`                  | Generate Drizzle migrations from `src/infrastructure/db/schema.ts` |
| `pnpm db:migrate`                   | Apply migrations                                                   |
| `pnpm db:studio`                    | Drizzle Studio                                                     |

## Project Structure

```
src/
  app/                 Next.js routes (App Router)
  core/auth/           Auth.js config, requireRole() (added in Phase 4)
  infrastructure/db/   Drizzle client, schema, migrations
  features/            One folder per capability (domain/application/infrastructure)
```

Business capability implementations start in Phase 2 (`sdd/rincon-empanadero-management-app/tasks`, Engram) — this scaffold intentionally contains no pricing/catalog/storefront logic yet.
