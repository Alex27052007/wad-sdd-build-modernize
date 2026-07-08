# Plan: Duck of the Day (`duck-of-the-day`)

**Source spec:** `specs/duck-of-the-day/spec.md`
**Depends on:** `browse-catalog` (existing duck catalog model)
**Status:** Draft — awaiting approval

## Resolved open questions

- **Day key format:** accept a `string` day key in `YYYY-MM-DD` form for a simple, deterministic input.
- **Tie-breaking:** use the catalog order after a stable hash of the day key so the same day always yields the same duck, while different days move through the eligible set predictably.

## Data model

No new Duck fields are required. The feature uses the existing catalog and returns either:

```ts
// src/catalog.ts
export type DuckOfTheDayResult =
  | { ok: true; duck: Duck }
  | { ok: false; message: string };
```

The fallback message is the exact string from the spec:

- `The pond is empty today, come back tomorrow.`

## Module / file layout

A single catalog-oriented module is sufficient:

```text
src/
  catalog.ts        # selectDuckOfTheDay + helper logic
  catalog.test.ts   # determinism, sold-out filtering, fallback behavior
```

This keeps the feature library-style and easy to consume from a future UI layer.

## Public interfaces

```ts
// src/catalog.ts
export function selectDuckOfTheDay(
  ducks: Duck[],
  dayKey: string,
): DuckOfTheDayResult;
```

Implementation notes:
- eligible ducks are those with `stock > 0`
- the selected duck is determined by a stable index derived from the day key and the eligible catalog order
- if no eligible ducks exist, return `{ ok: false, message: "The pond is empty today, come back tomorrow." }`

## External dependencies

None. The implementation uses only existing TypeScript/Node runtime facilities.

## Testing strategy

Vitest will cover the spec acceptance criteria directly:

1. **Determinism** — the same day key returns the same duck; different day keys return a different duck when eligible ducks exist.
2. **Sold-out filtering** — ducks with `stock: 0` are ignored.
3. **Fallback** — when all ducks are sold out, the function returns the friendly message.
4. **Purity** — the function does not mutate the input catalog and can be tested without a server.

## Risks

- **Hash stability:** a simple deterministic hash over the day key avoids accidental randomness and keeps the behavior reproducible across runs.
- **Catalog order sensitivity:** the implementation should preserve the existing catalog order and only change the selection index, not the order of ducks.
