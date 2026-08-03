# Spike: Schema-driven fuzzing with @traversable/zod-test

**Date:** 2026-08-03
**Conclusion:** Not viable. Use fast-check directly instead.

## What we tried

Evaluate `@traversable/zod-test` v0.0.28 for generating valid/invalid
test inputs from existing zod tool schemas.

## Findings

1. **Packaging issues.** `@traversable/zod-types` is marked optional in
   `peerDependenciesMeta` but is hard-required by the `fuzz.js` module.
   The package fails at `require()` time without it.

2. **Runtime error.** After installing all peer deps, `SchemaGenerator`
   throws `mrng.nextInt is not a function` — an internal runtime crash.
   The library is pre-1.0 and has not stabilized.

3. **Design mismatch.** The library generates random zod *schemas* from
   seeds. Our use case is the inverse: we have schemas and want
   arbitrary valid/invalid *inputs*. The `seedToValidData` function
   exists but requires the seed/schema mapping pipeline to work first,
   which is where the crash occurs.

## Recommendation

Use `fast-check` directly. We already have it at 4.6.0 (pinned) and
`@fast-check/vitest` at 0.4.0. Fast-check can derive arbitraries from
zod schemas, and the vitest integration gives us property-based tests
with minimal boilerplate.
