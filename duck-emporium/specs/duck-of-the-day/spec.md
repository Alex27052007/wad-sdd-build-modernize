# Spec: Duck of the Day (`duck-of-the-day`)

**Source story:** `../user-stories/07-duck-of-the-day.md`
**Depends on:** `browse-catalog`
**Status:** Draft — awaiting approval

## Problem

The catalog is available, but the store still has no daily hook that gives customers a reason to return. A simple, deterministic “Duck of the Day” feature would create a recurring touchpoint without requiring personalization or a full marketing system.

## Users

- **Quincy Quacker (customer):** wants a daily featured duck that feels fresh but remains predictable.
- **Later stories / other code (indirect):** the web frontend (story 9) will surface the duck on the home page and link it to the detail view.

## Scope

### In scope

- A pure function that selects a featured duck for a given day.
- Deterministic selection so the same duck appears for every request on the same day.
- Selection that skips sold-out ducks.
- A friendly empty fallback when no duck is available.
- A simple contract that can later be exposed through a home page or endpoint.

### Out of scope

- Per-user personalization.
- Manual curator override.
- Push notifications or reminder emails.

## Functional requirements

### FR1 — Daily selection

- The feature accepts a date (or day key) and a catalog of ducks.
- It returns one duck for that day, or a fallback value when no eligible duck exists.
- The selection is deterministic for the provided day key: the same input day always returns the same result.
- A different day key produces a different result when eligible ducks exist.

### FR2 — Sold-out handling

- Ducks with no remaining stock are not eligible for Duck of the Day.
- If one or more ducks are eligible, the selection uses only those ducks.
- If no ducks are eligible, the feature returns the friendly fallback message.

### FR3 — Fallback behavior

When no eligible duck exists, the feature returns the friendly message:

- `The pond is empty today, come back tomorrow.`

This is a deliberate fallback value, not an exception.

### FR4 — Integration expectation

The selected duck should be usable by the future web frontend as the featured item on the home page, with a link to the corresponding duck detail page.

## Non-functional requirements

- **NFR1 — Stack:** TypeScript, ES modules, Node 20+, `node:`-prefixed built-ins only.
- **NFR2 — Tests:** Vitest tests live next to source as `*.test.ts` and cover determinism, sold-out behavior, and the fallback case.
- **NFR3 — Purity:** the selection logic is pure and does not mutate the catalog or rely on external state.

## Acceptance criteria

1. The same duck is returned for the same day and a different duck is returned on a different day when eligible ducks exist.
2. Sold-out ducks are skipped.
3. If all ducks are sold out, the feature returns the friendly fallback message.
4. The selection logic is pure and testable without a web server.
5. The full suite (`npm test`) passes.

## Open questions

- **Day key format:** should the feature accept a `Date` object, a `YYYY-MM-DD` string, or a numeric day index? Default assumption: a `Date` object or a string-based day key is acceptable as long as the behavior is deterministic.
- **Tie-breaking:** if multiple ducks could be selected for a day, should the implementation use the first eligible duck in catalog order or a stable hash-based choice? Default assumption: stable, deterministic selection based on the day key and catalog order.
