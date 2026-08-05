# Ludo DZ

A feature-rich, themed Ludo board game app built with React + Vite, backed by an Express API server. The project lives in a pnpm monorepo.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS v4, shadcn/ui, Framer Motion |
| Backend | Express 5, Pino logging |
| DB (ORM) | Drizzle ORM (PostgreSQL) |
| State | Tanstack Query v5, Wouter routing |
| Monorepo | pnpm workspaces |

## Project structure

```
artifacts/
  ludo-dz/        # React + Vite frontend (the game UI)
  api-server/     # Express API server
lib/
  api-spec/       # OpenAPI spec + codegen
  api-zod/        # Zod schemas (generated)
  api-client-react/  # React Query hooks (generated)
  db/             # Drizzle schema and migrations
```

## How to run

Both services start automatically via the **Project** workflow (run button).

- **Frontend** — `pnpm --filter @workspace/ludo-dz run dev` on port 21341, served at `/`
- **API server** — `pnpm --filter @workspace/api-server run dev` on port 8080, served at `/api`

To install dependencies: `pnpm install` from the workspace root.

## User preferences

- Keep the project's existing structure and stack — do not restructure or migrate it.
