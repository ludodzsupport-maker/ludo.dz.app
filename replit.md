# Ludo DZ

A full-stack Ludo board game built with React and Express, using a contract-first API approach.

## Tech Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS 4, Framer Motion, Radix UI, Wouter, TanStack Query
- **Backend:** Node.js, Express 5, TypeScript, esbuild
- **Database:** PostgreSQL via Drizzle ORM
- **API Tooling:** OpenAPI spec (YAML) with Orval for codegen (Zod schemas + React Query hooks)

## Project Structure

```
artifacts/ludo-dz/       # React frontend (Vite, served at /)
artifacts/api-server/    # Express backend (served at /api)
artifacts/mockup-sandbox/# UI prototyping environment
lib/db/                  # Database schema and Drizzle config
lib/api-spec/            # OpenAPI definitions and Orval config
lib/api-zod/             # Generated Zod schemas (do not edit)
lib/api-client-react/    # Generated React Query hooks (do not edit)
```

## Running the Project

Both services start automatically via Replit workflows:

- **Frontend:** `pnpm --filter @workspace/ludo-dz run dev` (port 21341, preview at `/`)
- **Backend:** `pnpm --filter @workspace/api-server run dev` (port 8080, routed at `/api`)

## Required Environment Variables

| Variable       | Source                        | Notes                          |
|----------------|-------------------------------|--------------------------------|
| `DATABASE_URL` | Auto-provided by Replit       | PostgreSQL connection string   |
| `SESSION_SECRET` | Replit secret (already set) | Used for session signing       |
| `PORT`         | Injected by workflow          | Do not hardcode                |

## Development Workflow

### API Changes
1. Edit `lib/api-spec/openapi.yaml` (single source of truth)
2. Run codegen: `pnpm run --filter @workspace/api-spec codegen`
3. Implement route in `artifacts/api-server/src/routes/`

### Database Changes
- Edit schema in `lib/db/src/schema/index.ts`
- Push changes: `pnpm --filter @workspace/db run push`

## User Preferences
