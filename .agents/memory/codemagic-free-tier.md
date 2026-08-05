---
name: Codemagic free-tier instance types
description: Which codemagic.yaml instance_type values work without billing enabled
---

As of August 2026, Codemagic's official yaml docs (yaml-basic-configuration/yaml-getting-started)
list exactly 5 `instance_type` keywords: `mac_mini_m2`, `mac_mini_m4`, `linux_x2`, `linux_x4`,
`windows_x2`. The docs explicitly state that `mac_mini_m4`, `linux_x2`, `linux_x4`, and
`windows_x2` all require billing enabled — leaving **`mac_mini_m2` as the only instance type
that works on an unbilled/free account**.

There is no free-tier Linux keyword (no `linux_x1`, no bare `linux`) despite that being a common
assumption/guess (older Codemagic plans apparently used to offer a free Linux class; that's gone
from current docs). A third-party pricing tracker corroborates this: Codemagic's free tier is
described as "500 macOS M2 build minutes," with no Linux minutes mentioned.

**Why:** A user asked to fix a "selected instance type is not available with the current billing
plan" error by switching `linux_x2` to a guessed `linux_x1`/`linux` value. Verifying against
current docs (not assuming the guess was right) revealed no such free Linux option exists at all.

**How to apply:** If a codemagic.yaml build fails with a billing/instance-type error and the
project must stay on the free tier, the only drop-in fix is `instance_type: mac_mini_m2` — not a
Linux variant. This changes the build OS from Linux to macOS; shell-script-based workflows (npm,
pnpm, cordova/gradle, etc.) generally still run fine on Codemagic's Mac images since those also
ship Android SDK/Java, but flag the OS change to the user if their yaml comments or requirements
specifically called for a Linux machine. Re-verify against current docs before relying on this —
Codemagic's lineup has changed before and may change again.
