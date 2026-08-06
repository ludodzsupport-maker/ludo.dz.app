---
name: dvh viewport-unit fallback pattern
description: How to safely fall back from the `dvh` CSS unit to `vh` for older WebViews/browsers without the fallback being silently stripped by CSS minification.
---

The `dvh` (dynamic viewport height) unit isn't universally supported —
notably on older/unpatched Android System WebView (`dvh` needs roughly
Chromium 108, Nov 2022; WebView updates are tied to the device, not to the
app's `minSdkVersion`, so a low `minSdkVersion` is a risk factor, not proof
either way). When unsupported, the unit doesn't degrade per-value — the
**whole declaration** is invalid and dropped, reverting the property to its
initial value (`height: auto` for `height`/`min-height`). In a layout where
the sized element's children are `position: absolute; inset: 0` (a common
full-screen app-shell pattern), that `auto` height collapses to 0 and
everything inside vanishes even though it mounted correctly — visually
indistinguishable from a JS/render failure from the outside, except only an
ancestor's background paints.

**The obvious fix is wrong in a way that fails silently.** Writing the same
property twice in one rule (`height: 100vh; height: 100dvh;`), relying on
"unsupported values are ignored and the last valid one wins," is normal,
spec-correct CSS — but real-world CSS minifiers (confirmed: the one in this
project's Vite 7 build pipeline) treat a duplicate property within a single
rule as dead code and strip everything but the textually-last declaration,
without evaluating whether that value is actually supported at runtime.
Result: the `vh` fallback silently disappears from the production/minified
build even though it worked in dev (unminified) — passing every check
except an actual build-and-grep of the compiled output.

**Why:** minifiers optimize on "a later same-property declaration always
wins," which is only true for values the *target engine* understands; the
build tool has no browser-support matrix, so it can't know a later value
might be the one that fails at runtime.

**How to apply:** Gate the enhancement with `@supports (height: 100dvh) {
... }` in a separate rule instead of stacking two declarations in one.
`@supports` blocks are preserved by minifiers (collapsing them would change
feature-detection semantics) and are evaluated by the real runtime engine,
not the build tool. After writing a fix like this, verify by grepping the
actual minified build output for both the base and the gated declaration —
dev-server/HMR CSS is unminified and won't reveal a minifier-collapse bug.

For inline React `style={{...}}` objects (not CSS classes), neither CSS
trick applies — a JS object literal can't hold two values for one key.
Feature-detect once at module load (`CSS.supports('height', '100dvh')`) and
branch the computed string value in JS instead.
