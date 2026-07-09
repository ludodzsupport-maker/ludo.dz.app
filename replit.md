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

## Development

```bash
# Install all workspace dependencies
pnpm install

# Type-check everything
pnpm typecheck

# Build all packages
pnpm build
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
```

## User preferences

(none yet)
