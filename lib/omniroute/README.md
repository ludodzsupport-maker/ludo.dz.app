# OmniRoute AI Gateway client

Server-side utility for routing AI requests through an OmniRoute/OpenAI-compatible gateway.

## Required environment

```bash
OMNIROUTE_API_KEY=sk_...
OMNIROUTE_BASE_URL=http://localhost:20128/v1
```

`OMNIROUTE_BASE_URL` should point at the OpenAI-compatible `/v1` base URL for your OmniRoute gateway.
Never expose `OMNIROUTE_API_KEY` to browser/client bundles; import this package only from server-side code,
API handlers, background jobs, or validation scripts.

## Validation

From the repository root, run:

```bash
pnpm run omniroute:check
```

The check calls OmniRoute's `/models` endpoint with Bearer token authentication and prints a redacted success
summary. To additionally exercise chat completions, provide a model:

```bash
OMNIROUTE_VALIDATION_MODEL=auto/kimi-k2 pnpm run omniroute:check
```
