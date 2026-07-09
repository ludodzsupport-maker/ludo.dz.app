# Ludo DZ

A full-stack Ludo board game built with React + Vite (frontend) and Express (backend), managed as a pnpm monorepo.

## Stack

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS 4, Framer Motion, Radix UI, Wouter, TanStack Query
- **Backend**: Node.js, Express 5, TypeScript, esbuild
- **Database**: PostgreSQL (Replit built-in) with Drizzle ORM
- **API**: Contract-first with OpenAPI YAML + Orval codegen (Zod schemas + React Query hooks)

## Project Structure

```
artifacts/
  ludo-dz/        # React frontend (port 21341)
  api-server/     # Express backend (port 8080)
  mockup-sandbox/ # UI prototyping
lib/
  api-spec/       # openapi.yaml + Orval config
  api-zod/        # Generated Zod schemas (do not edit)
  api-client-react/ # Generated React Query hooks (do not edit)
  db/             # Drizzle schema and config
scripts/          # Internal workspace tools
```

## How to Run

Both workflows start automatically:
- **Frontend**: `artifacts/ludo-dz: web` — Vite dev server on port 21341
- **Backend**: `artifacts/api-server: API Server` — Express on port 8080

To install dependencies: `pnpm install` (from root)

To build shared lib declaration files (required after fresh install or codegen):
```
pnpm --filter @workspace/db run build
pnpm --filter @workspace/api-zod run build
```

To push DB schema changes: `pnpm --filter @workspace/db run push`

To regenerate API client code: `pnpm --filter @workspace/api-spec run codegen`

## Environment

- `DATABASE_URL` — auto-provided by Replit (PostgreSQL)
- `SESSION_SECRET` — set as a Replit Secret

## Development Conventions

- API changes must start in `lib/api-spec/openapi.yaml`, then run codegen
- Do not edit files in `lib/api-zod/` or `lib/api-client-react/` directly
- Use pnpm only (a `preinstall` script rejects npm/yarn)

## User Preferences
