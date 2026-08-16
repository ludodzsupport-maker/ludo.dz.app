---
name: design-taste-frontend
source: https://github.com/Leonxlnx/taste-skill
installed_via: npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"
loaded_for_project: true
---
# tasteskill: Anti-Slop Frontend Skill

This project loads the Taste Skill UI design rules for all upcoming UI implementations.

## Required workflow for every UI task

1. Start with a one-line design read: `Reading this as: <page kind> for <audience>, with a <vibe> language, leaning toward <design system or aesthetic family>.`
2. Set and state the three dials before implementation:
   - `DESIGN_VARIANCE`
   - `MOTION_INTENSITY`
   - `VISUAL_DENSITY`
3. Choose one foundation only. Use the official design-system package when a brief maps to a real system; otherwise be explicit that the implementation is aesthetic inspiration.
4. Verify dependencies before importing third-party libraries.
5. Finish every UI change with the pre-flight checklist below.

## Baseline dials

Use these unless the brief clearly calls for different values:

- `DESIGN_VARIANCE: 8`
- `MOTION_INTENSITY: 6`
- `VISUAL_DENSITY: 4`

## Core rules loaded from Taste Skill

- Avoid AI-default visuals: purple/blue glow gradients, centered dark mesh heroes, three equal feature cards, generic glassmorphism everywhere, Inter + slate defaults, and meaningless looping motion.
- Prefer intentional typography, calibrated color, asymmetric layout where appropriate, real imagery, explicit mobile fallbacks, and motivated motion.
- Use `min-h-[100dvh]`, not `h-screen`, for viewport-height sections.
- Use CSS Grid for layout rather than fragile flex percentage math.
- Use one icon family per project. Prefer Phosphor, HugeIcons, Radix Icons, or Tabler. Do not hand-roll SVG icon paths.
- Discourage emoji in visible UI unless the brief explicitly asks for a playful or social-native tone.
- Keep one palette, one accent color, and one corner-radius system per page unless a documented system says otherwise.
- Do not use em-dashes in UI copy.
- Do not ship div-based fake screenshots. Use generated images, real screenshots, real component previews, or clearly labeled placeholders.
- Consumer-facing pages need light and dark mode planning unless the user explicitly asks for one mode only.
- Respect reduced-motion preferences and clean up all effect-driven animation code.

## Pre-flight checklist

Before declaring a UI task complete, verify:

- [ ] Design read declared.
- [ ] Dial values explicit and brief-driven.
- [ ] One design system or aesthetic foundation chosen.
- [ ] No em-dashes in visible UI copy.
- [ ] One page theme strategy and one accent color.
- [ ] Button and form contrast meet WCAG AA.
- [ ] Hero fits the initial viewport, with CTAs visible without scrolling.
- [ ] Navigation stays on one desktop line and remains below 80px tall.
- [ ] Eyebrow labels are restrained, at most one per three sections.
- [ ] No duplicate CTA intent on the same page.
- [ ] Real images or explicit image placeholders are used where the design needs visuals.
- [ ] Mobile collapse behavior is explicit for each multi-column layout.
- [ ] Reduced motion is handled for non-trivial animations.
- [ ] Dark mode tokens or variants are defined when applicable.
- [ ] Empty, loading, and error states exist for interactive UI.

## Source of truth

The full upstream skill is Leonxlnx/taste-skill. If this local adapter ever conflicts with the upstream `design-taste-frontend` skill, follow the upstream skill.
