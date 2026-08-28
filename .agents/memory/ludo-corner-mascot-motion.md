---
name: Ludo corner mascot hide/peek/retreat model
description: How CornerMascot hides behind the dice cards, the exact clip-window geometry, the idle head-peek hint, and the mood gesture layers — plus the invariants that must not break.
---

# CornerMascot motion model (hide → climb to peek → retreat)

**File:** `artifacts/ludo-dz/src/components/CornerMascot.tsx`

## Geometry (the part that broke once — keep these invariants)

The character lives in a clip window (`overflow: hidden`) glued to the card's board-facing edge:
- Top panels (gaze `"down"`): window ABOVE the card, `bottom: panelH` on the panel wrapper.
- Bottom panels (gaze `"up"`): window BELOW the card, `top: panelH`.
- Window height = `mascotH + HEADROOM(8)`; the climb layer is `mascotH` tall anchored to the **card-adjacent edge** (`bottom: 0` for gaze down, `top: 0` for gaze up).
- `yHidden = winH + 2` — one uniform DOWNWARD travel for all four corners. Both orientations hide **downward** (behind the card for top panels, below the window for bottom panels) and climb **upward**. Never reintroduce per-gaze hide directions: the old bug hid top-panel mascots by translating UP, which left a floating feet-sliver detached in mid-air ~50px from the card ("characters fully visible at all times").

## Idle hint

A separate tiny element (`data-mascot-hint`) shows only the top `hintH = max(5, 14% of mascotH)` px of the same artwork, flush against the card's edge (bottom strip of the window for top panels, top strip for bottom panels). It fades out fast (0.12s) when the character becomes visible and back in after 0.3s. Because the climbing character's head passes through the exact same strip with the same art, the crossfade is pixel-identical. Yellow's hint is its trophy/arm tip (its art leans left at the top) — expected, not a bug.

## Gestures

State machine: `hidden → greet (1s, on active's false→true edge) → joy | sad | roll | anticipate | idle`, all transform-only on a layer with `transformOrigin: 50% 100%` (pivot at the card edge). Bottom panels must keep hop amplitudes small (≤ ~2px + stretch): their clip edge on the head side IS the card edge, so a big hop hides the head mid-jump. Reduced motion / Neon pause (`still`): fade-based climb, no loops, static hint.

## DOM hooks for testing

`data-mascot={player}` (window), `data-mascot-stage` (climb layer), `data-mascot-hint`. The active panel is detectable by card width (active card scales to 1.08 vs 0.88).
