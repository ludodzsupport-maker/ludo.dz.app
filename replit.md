# Ludo DZ

A digital Ludo board game built as a full-stack pnpm monorepo on Replit.

## Stack

- **Frontend** (`artifacts/ludo-dz`): React 19, Vite 7, Tailwind CSS 4, Framer Motion, Wouter, TanStack Query
- **Backend** (`artifacts/api-server`): Node.js + Express 5, TypeScript, esbuild, Drizzle ORM, Pino logging
- **Shared libs** (`lib/`): `api-spec`, `api-zod`, `api-client-react`, `db`
- **Package manager**: pnpm workspaces

## How to run

Both services start automatically via the "Project" run button:

| Service | Port | Command |
|---|---|---|
| Ludo DZ frontend | 21341 | `PORT=21341 BASE_PATH=/ pnpm --filter @workspace/ludo-dz run dev` |
| API server | 8080 | `PORT=8080 pnpm --filter @workspace/api-server run dev` |

## Environment

The project uses Replit's built-in PostgreSQL database. The following environment variables are provided automatically by the Replit runtime — no manual configuration needed:

- `DATABASE_URL` — full PostgreSQL connection string (runtime-managed)
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` — individual DB credentials
- `SESSION_SECRET` — stored as a Replit secret

The `postgresql-16` Nix module is included in `.replit` so `psql` and related CLI tools are available in the shell.

## Development

```bash
# Install all workspace dependencies
pnpm install

# Push the Drizzle schema to the database (run after schema changes)
pnpm --filter @workspace/db run push

# Type-check everything
pnpm typecheck

# Build all packages
pnpm build
```

## Post-merge setup

`scripts/post-merge.sh` runs automatically after task merges:

```bash
pnpm install --frozen-lockfile
pnpm --filter db push
```

## Project structure

```
artifacts/
  ludo-dz/          # React/Vite frontend (the game UI)
  api-server/       # Express API backend
  mockup-sandbox/   # UI prototyping sandbox
lib/
  api-spec/         # OpenAPI spec + codegen
  api-zod/          # Zod schemas (generated)
  api-client-react/ # React Query hooks (generated)
  db/               # Drizzle ORM schema + client
scripts/
  post-merge.sh     # Runs after task agent merges (install + db push)
```

## User preferences

(none yet)
