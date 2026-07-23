---
description: Conventions for Bitbucket tool modules
globs: "src/tools/**/*.ts"
---

Read tools curate with `curateList` / `curateResponse` and
`fields ?? DEFAULT_*_FIELDS`. Skip curation only when the response has
nothing heavy to trim -- `list_merge_checks` in `merge-checks.ts` is the
documented precedent.

Mutating tools call `toolAnnotations()` with the right hints
(`readOnlyHint: false` for writes).

See `CONTRIBUTING.md` for the full walkthrough on adding a tool.
