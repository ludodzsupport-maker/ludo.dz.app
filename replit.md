# Ludo DZ

A full-stack Ludo board game built with React + Vite (frontend) and Express (backend), managed as a pnpm monorepo.

## Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, Framer Motion, Radix UI, Wouter (routing), TanStack Query
- **Backend:** Node.js + Express 5, TypeScript, esbuild
- **Database:** PostgreSQL (Replit-managed) via Drizzle ORM
- **API layer:** OpenAPI spec → Orval codegen → typed React Query hooks + Zod schemas
- **Monorepo:** pnpm workspaces

## Project Structure

```
artifacts/
  ludo-dz/          React + Vite frontend (the game)
  api-server/       Express API backend
  mockup-sandbox/   UI prototyping sandbox (dev-only)
lib/
  db/               Drizzle ORM config + PostgreSQL schema
  api-spec/         OpenAPI spec (openapi.yaml) + Orval config
  api-zod/          Generated Zod schemas
  api-client-react/ Generated TanStack Query hooks
```

## Running the project

Dependencies are managed by pnpm. Install once:

```bash
pnpm install
```

Both services start automatically via Replit workflows:
- **Frontend** (`artifacts/ludo-dz: web`) — Vite dev server on port 21341
- **API Server** (`artifacts/api-server: API Server`) — Express on port 8080 (build-then-start; no hot reload on backend changes — restart the workflow to pick up API edits)
- **Canvas / Mockup Sandbox** (`artifacts/mockup-sandbox: Component Preview Server`) — dev-only UI prototyping environment; start manually when needed

## Environment variables

| Variable       | Description                              |
|----------------|------------------------------------------|
| `DATABASE_URL` | PostgreSQL connection string (auto-set by Replit) |
| `SESSION_SECRET` | Secret for session signing (set as a Replit Secret) |
| `PORT`         | Service port (injected by artifact workflows) |
| `BASE_PATH`    | URL prefix for frontend routing (injected by artifact workflows) |

## API development

1. Edit `lib/api-spec/openapi.yaml` to add/change endpoints
2. Run codegen: `pnpm --filter @workspace/api-spec run codegen`
3. Implement routes in `artifacts/api-server/src/routes/`
4. Use generated hooks from `@workspace/api-client-react` in the frontend

## Database

Schema lives in `lib/db/src/schema/`. After editing:

```bash
pnpm --filter @workspace/db run push
```

`DATABASE_URL` is runtime-managed by Replit — no manual setup needed.

## User preferences

- Keep the existing monorepo structure; do not restructure or migrate it.
