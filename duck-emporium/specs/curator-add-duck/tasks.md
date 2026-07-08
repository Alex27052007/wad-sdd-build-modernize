# Tasks: Add a duck via curator endpoint (`curator-add-duck`)

**Source plan:** `specs/curator-add-duck/plan.md`
**Status:** Draft — awaiting approval

## Task 1 — Add core add-duck validation and id generation

**Files:** `src/catalog.ts`
**Depends on:** nothing

Implement the pure core of the feature:
- `slugifyName(name)` for deterministic, stable ids
- `CreateDuckInput` and `AddDuckResult` types
- validation for required fields, price, stock, and traits
- duplicate-name detection based on a normalized name
- generation of a new `Duck` record with a slug id

**Acceptance check:** the helper can be exercised from a test without any persistence or auth concerns.

## Task 2 — Add catalog persistence for successful adds

**Files:** `src/catalog.ts`, `src/catalog.test.ts`
**Depends on:** Task 1

Wire the successful add flow to persist the updated catalog atomically to disk.

Behavior to cover:
- a successful add appends the duck to the catalog
- the updated catalog is written to disk
- a fresh `loadCatalog()` sees the new duck

**Acceptance check:** the resulting catalog is persisted and visible after reloading.

## Task 3 — Add admin-auth wrapper and logging

**Files:** `src/catalog.ts`, `src/catalog.test.ts`
**Depends on:** Task 2

Implement the endpoint-facing wrapper:
- `handleAdminAddDuck(request, catalog, filePath?, logger?)`
- reject missing or incorrect `ADMIN_PASSWORD` with an HTTP 401-style failure
- log successful adds to stdout with timestamp and duck name only

**Acceptance check:** auth failures and successful logging paths are covered by tests.

## Task 4 — Add regression coverage for validation failures

**Files:** `src/catalog.test.ts`
**Depends on:** Task 3

Add tests for validation failures including:
- missing required fields
- duplicate names
- negative price
- negative stock
- non-integer stock
- malformed traits

**Acceptance check:** all validation error cases return a clear failure message.

## Task 5 — Final acceptance sweep

**Files:** none expected (fixes only if a gap is found)
**Depends on:** Tasks 1–4

Run the full suite and confirm the curator add-duck acceptance criteria are covered by passing tests.

**Acceptance check:** `npm test` passes and the story’s acceptance criteria are all covered by green tests.

## Suggested commit order

1 → 2 → 3 → 4 → 5
