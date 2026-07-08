# Tasks: Duck of the Day (`duck-of-the-day`)

**Source plan:** `specs/duck-of-the-day/plan.md`
**Status:** Draft — awaiting approval

## Task 1 — Add deterministic selection helper

**Files:** `src/catalog.ts`
**Depends on:** nothing

Implement a pure `selectDuckOfTheDay(ducks, dayKey)` helper that:
- filters out ducks with `stock <= 0`
- picks a stable duck based on the provided day key and the eligible catalog order
- returns a fallback result when no eligible ducks exist

**Acceptance check:** the helper can be exercised from a test without any UI or server layer.

## Task 2 — Add catalog tests for determinism and sold-out handling

**Files:** `src/catalog.test.ts`
**Depends on:** Task 1

Write tests covering:
- the same day key returns the same duck
- different day keys return a different duck when eligible ducks exist
- sold-out ducks are skipped
- the fallback message is returned when every duck is sold out
- the function does not mutate the input catalog

**Acceptance check:** the new catalog tests pass and capture the feature contract.

## Task 3 — Final acceptance sweep

**Files:** none expected (fixes only if a gap is found)
**Depends on:** Tasks 1–2

Run the full suite and confirm the duck-of-the-day acceptance criteria are covered by passing tests.

**Acceptance check:** `npm test` passes and the story’s acceptance criteria are all covered by green tests.

## Suggested commit order

1 → 2 → 3
