---
name: Ludo board-theme timing isolation
description: Keeps Classic-specific dice timing changes from leaking into Neon and DZ.
---

Board animation speed presets are shared by the Classic, Neon, and DZ themes. Any timing adjustment intended only for one theme must be selected locally at the point that schedules that theme's behavior, rather than mutating a shared preset.

**Why:** A shared timing edit silently changes roll feel in the other two themes, even when their visuals and sound systems are otherwise separate.

**How to apply:** Keep any board-style override guarded by the relevant theme condition and limited to the affected interaction timing. Leave shared physics and the other themes' scheduling on their existing presets unless a cross-theme change is intentional.