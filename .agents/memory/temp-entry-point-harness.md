---
name: Temporary entry-point swap for screenshotting hard-to-reach UI states
description: How to visually verify a component that only appears after a long/random interaction sequence (match end, error state, empty state) when there is no interactive-browser tool, only a static Screenshot.
---

The `Screenshot` tool is view-only — it loads a URL and captures it, but cannot click, type, or otherwise drive the app forward. For UI that only appears after a long or non-deterministic sequence (e.g. a game's match-end screen, which could take many real turns to reach, or an error/empty state gated behind specific data), playing through the app for real is not a practical way to verify.

**Technique:** temporarily repoint the app's real entry point (e.g. `src/main.tsx`) to a small throwaway component that mounts the target component directly with hand-built mock props/state, wrapped in whatever outer layout chrome (phone-frame div, RTL wrapper, etc.) the real app normally provides so the screenshot is representative. Read query-string params (`?theme=x&lang=y&scenario=z`) inside that throwaway file to sweep multiple variants (themes, languages, edge-case data shapes) across several `Screenshot` calls without needing separate files per variant. Screenshot each variant, then **revert the entry-point file to its exact original content** (rewrite from the content you read before editing) and confirm the real app still boots cleanly afterward.

**Why this is safe:** the entry-point swap never lands in the delivered diff — `git status`/`git diff --stat` after reverting shows the file untouched, so it doesn't count against an "additive only" or "don't touch existing logic" constraint, even though it was edited mid-session. Only the target component and its real (non-test) wiring are part of the final change set.

**How to apply:** use this whenever a task requires visually verifying a component that (a) already exists as a real, importable component and (b) is gated behind app state that's slow, random, or otherwise impractical to reach by simulated navigation. Don't use it as a substitute for verifying the *real* wiring (the actual trigger condition, state updates, callbacks) — confirm that separately via code reading + `tsc --noEmit` + clean HMR compile logs, since the harness bypasses the real trigger path entirely.
