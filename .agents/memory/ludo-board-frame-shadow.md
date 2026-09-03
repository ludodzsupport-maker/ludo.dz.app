---
name: Ludo DZ board frame shadow (DZ/Neon glow removal)
description: The animated board-wrapper box-shadow that DZ and Neon used to run, why it was expensive, and the measured before/after of replacing it with the static shadow Classic/Normal already used.
---

# Board frame shadow: static for every theme (Sep 2026)

Classic's animated board-wrapper shadow was removed first; **DZ and Neon kept the
same loop** until this change (`GameBoardScreen.tsx`, `boardShadowAnimation` /
`boardShadowTransition` on the board wrapper `motion.div`):

```
0 0 28px <player>28, 0 0 60px rgba(0,0,0,.65)
→ 0 0 48px <player>55, 0 0 80px rgba(0,0,0,.65) → back     (2.6s, repeat ∞)
```

Two large blurs under a full-board element, re-rasterized every frame.

**Fix:** one `boardShadow` memo — `0 10px 30px rgba(0,0,0,0.45)` for every theme,
plus a **static** player-tinted halo for Neon (`0 0 26px <activeColor>33`) so the
theme keeps its identity without a loop. `exitPause` still settles the corner
panels; it no longer affects the shadow.

## Measured (idle, 3s window, medians of 3 reps, variants measured back-to-back)

| | fps | long frames | raster ms / frame |
|---|---|---|---|
| DZ before | 20.4 | 61.7 | 46.4 |
| DZ after | 48.4 | 1.3 | 18.0 |
| Neon before | 50.2 | 6.0 | 16.8 |
| Neon after | 81.7 | 0.7 | 9.1 |

During a dice roll: DZ 19.4 → 46.6 fps, Neon 49.8 → 82.9 fps; total raster in the
3s roll window −8.5% (DZ) and −13% (Neon).

## Gotcha

A "before" state saturated by a huge blur is **insensitive to machine load**, the
"after" state is not. The sandbox drifted ~2× within one session, so the two
variants must be measured back-to-back — an afternoon-old "after" number compared
against a fresh "before" number produces a nonsense delta.
