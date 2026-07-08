# Tasks: Search and filter the catalog (`search-and-filter`)

**Source plan:** `specs/search-and-filter/plan.md`
**Status:** Draft — awaiting approval

## Task 1 — Add filtering helper and types

**Files:** `src/catalog.ts`
**Depends on:** nothing

Add a pure `DuckFilters` type and a `filterDucks(ducks, filters)` helper in `src/catalog.ts`.

Implement the following behavior:
- normalize the query with a case-insensitive substring match against `name`, `tagline`, and `description`
- match categories case-insensitively against one or more selected categories
- apply inclusive min/max price bounds when provided
- combine all enabled filters with logical AND semantics
- return a new array without mutating the input catalog or the duck records

**Acceptance check:** the helper can be exercised from a small test case without touching the UI layer.

## Task 2 — Add catalog tests for filtering semantics

**Files:** `src/catalog.test.ts`
**Depends on:** Task 1

Write Vitest tests that cover the filter contract from the plan and spec:
- free-text search matches `name`, `tagline`, and `description` case-insensitively
- category filtering supports one or more selected categories
- price filtering honors inclusive min/max bounds and treats omitted bounds as inactive
- combined filters apply together with AND semantics
- filtering returns a new array and does not mutate the input ducks

**Acceptance check:** the new catalog tests pass and demonstrate the core filtering behavior.

## Task 3 — Update catalog rendering for the empty-state message

**Files:** `src/render.ts`
**Depends on:** Task 1

Extend `renderCatalog` so that when a filtered result set is empty it renders the explicit message:
- `No duck matches your existential criteria.`

Keep the implementation pure and preserve the existing catalog rendering behavior for non-empty results.

**Acceptance check:** the new rendering path produces the friendly empty-state message instead of a blank or unchanged list.

## Task 4 — Add rendering tests for the empty state

**Files:** `src/render.test.ts`
**Depends on:** Task 3

Add or update tests to verify:
- an empty filtered result renders the friendly empty-state message
- non-empty output still includes the catalog content and remains unchanged in structure

**Acceptance check:** the render tests pass and the empty-state behavior is covered.

## Task 5 — Final acceptance sweep

**Files:** none expected (fixes only if a gap is found)
**Depends on:** Tasks 1–4

Run the full suite and confirm the search-and-filter acceptance criteria are covered by passing tests. Fix any missing behavior or regression discovered during the sweep.

**Acceptance check:** `npm test` passes and the story's acceptance criteria are all covered by green tests.

## Suggested commit order

1 → 2 → 3 → 4 → 5
