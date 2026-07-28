---
name: Artifact preview fallback when unregistered
description: Screenshot(appPreview) needs a registered artifact; when listArtifacts() is empty despite a working artifact.toml/workflow, use a rasterization fallback instead of fixing registration mid-task.
---

Symptom: `Screenshot({source:{type:"appPreview", artifactDirName:...}})` fails with "Artifact not found: <dir>", even though `artifacts/<slug>/.replit-artifact/artifact.toml` exists and its workflow(s) are configured and running normally. `listArtifacts()` (CodeExecution) confirms the registry is genuinely empty — seen on a project imported/restored from GitHub or checkpoints where the artifact.toml and workflows predate or survived independently of the runtime artifact registry.

**Why it matters:** `createArtifact()` cannot repair this — it requires a fresh slug and fails immediately if `artifacts/<slug>/` already has files. There is no documented "re-register existing artifact" callback. Chasing registration (deleting/recreating the directory, hand-editing artifact.toml) is invasive and disproportionate when the actual task is a narrow, scoped change that explicitly should not touch environment/config.

**How to apply:** Don't force artifact registration just to satisfy a screenshot when the task itself doesn't call for infra changes. Verify the change through means that don't require the registry:
- `tsc --noEmit` (or the project's typecheck/build script) for structural/type correctness.
- Workflow logs via RefreshAllLogs — a clean Vite HMR line for the edited file (no overlay/error) confirms the dev server compiled it successfully.
- For visual/SVG or isolated markup changes: write a standalone static file with the same shape/gradient data (flatten template placeholders and animation wrappers to static values), rasterize it with ImageMagick (`magick`/`convert` are preinstalled in the Replit env — no package install needed) at both a large inspection size and the actual small on-screen render size, then view the PNG via ReadFile's image support. This lets you actually judge design/legibility quality without a live browser screenshot.
- `git diff --stat` to confirm the edit is scoped to only the intended file(s) when a task has a "zero changes elsewhere" constraint.
