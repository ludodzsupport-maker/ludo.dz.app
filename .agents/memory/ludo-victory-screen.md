---
name: Ludo DZ victory/results screen architecture
description: Where match stats (moves/captures/duration) live, how the per-theme results card is styled, and the fanfare/gold-accent decisions behind it.
---

## Match stats live in GameBoardScreen state, not the engine
`ludo-engine.ts` has no stats tracking (`GameState` only has `winner`, not move/capture history) and was kept that way deliberately — adding a results screen did not touch the pure engine. Instead `GameBoardScreen.tsx` owns `moveCount`, `captureCounts` (array indexed by player color 0-3), and `matchDurationMs`/`matchStartRef`, all incremented/reset locally.

**Why:** keeps the engine pure and the change additive/low-risk; a results screen is presentation, not game logic.

**How to apply:** any future stat (e.g. "sixes rolled", "safe-cell landings") should follow the same pattern — add local state in `GameBoardScreen`, increment it at the single spot in `triggerMove` right after `capturedPid` is computed (this runs exactly once per real move regardless of which of the two commit paths — zero-step vs `onLastHop`-deferred — resolves it), and reset it in `handleRestart`. Per-player "pieces home" needs no tracking at all — it's derived at render time from `game.pieces`/`game.playerSlots` (already scoped to active players by `createGame`).

## Duration capture mirrors the existing win-haptic effect, but stays a separate effect
Match duration (`Date.now() - matchStartRef.current`) and the victory fanfare are both set from a `useEffect` keyed on `[game.winner]`, same pattern as the pre-existing win-haptic effect — but deliberately a *separate* effect, not added into the haptics one, so neither's firing conditions can affect the other. `matchStartRef` must be manually reset to `Date.now()` in `handleRestart` — "Play Again" never unmounts `GameBoardScreen` (same `key="game"` in App.tsx), so a plain lazy-init ref would otherwise keep timing from the very first match.

## Victory fanfare reuses each theme's welcome jingle — no new audio was written
`playNeonWelcomeJingle`/`playClassicWelcomeJingle`/`playDzWelcomeJingle` (sound-manager.ts) double as the victory cue, fired once from the duration-capture effect above. See `ludo-sound-architecture.md` for the broader per-theme SFX wiring pattern this fits into.

## Classic's "gold" accent is `#C9A227` — same hex DZ uses, but not in a shared constants file
Unlike DZ (`lib/board-theme-dz.ts`), Classic has no theme-constants file — its gold accents (border diamond-grid, stardust glints) are hardcoded inline inside `GameBoardScreen.tsx`'s per-theme background gradient ternary. `#C9A227` is the de facto shared "gold" between Classic and DZ even though nothing declares it as shared. Any new Classic- or DZ-themed UI (this results screen included) should reuse `#C9A227` rather than inventing a new gold, for visual continuity with the board it's shown over.

## RTL needed no manual mirroring logic
Setting `dir={lang === 'ar' ? 'rtl' : 'ltr'}` on the screen's root element was sufficient for the whole card — flexbox rows (icon/name/pips/count in each standings row, the 3-stat-chip row, the two CTA buttons) all mirror correctly via the browser's native bidi handling. No conditional `flex-direction` or manually-swapped left/right logic was needed anywhere in this component.
