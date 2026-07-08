# Plan: Search and filter the catalog (`search-and-filter`)

**Source spec:** `specs/search-and-filter/spec.md`
**Depends on:** `duck-detail` (existing catalog/detail implementation)
**Status:** Draft — awaiting approval

## Resolved open questions

- **Category matching:** case-insensitive exact match on `duck.category`; no alias normalization or fuzzy category expansion.
- **Search semantics:** substring match across `name`, `tagline`, and `description`; a blank/whitespace query is treated as inactive.
- **Empty-state copy:** the zero-result rendering uses the exact message from the spec: `No duck matches your existential criteria.`
- **API shape:** a single pure helper, `filterDucks`, keeps the filtering logic centralized and reusable by both the library and a future UI layer.

## Data model

No new Duck fields are required. The story adds a small filter descriptor used by the catalog layer:

```ts
// src/catalog.ts
export interface DuckFilters {
  query?: string;
  categories?: string[];
  minPrice?: number;
  maxPrice?: number;
}
```

The implementation normalizes the query and categories into a simple, deterministic predicate over the existing `Duck` records.

## Module / file layout

The story fits cleanly into the existing catalog/render split:

```text
src/
  catalog.ts        # DuckFilters + filterDucks
  catalog.test.ts   # filter matching, composition, and immutability
  render.ts         # reuse renderCatalog for the empty-state copy
  render.test.ts    # empty-result rendering behavior
```

No new module is necessary; filtering is a catalog query concern, while rendering remains in the presentation layer.

## Public interfaces

```ts
// src/catalog.ts
export interface DuckFilters {
  query?: string;
  categories?: string[];
  minPrice?: number;
  maxPrice?: number;
}

/** Returns a new array containing only ducks that satisfy all enabled
 *  filters. The input catalog is never mutated. */
export function filterDucks(ducks: Duck[], filters: DuckFilters = {}): Duck[];
```

```ts
// src/render.ts
/** Renders a catalog list, using an optional custom empty-state message.
 *  The default keeps the existing browse-catalog behavior intact. */
export function renderCatalog(
  ducks: Duck[],
  emptyMessage?: string,
): string;
```

This keeps the existing catalog rendering path intact while making the zero-result message configurable for the filter story.

## External dependencies

None. The implementation uses only the existing TypeScript/Node runtime and the current project dependencies.

## Testing strategy

Vitest tests will cover the spec acceptance criteria directly:

1. **Search matching** — case-insensitive query matching against `name`, `tagline`, and `description`.
2. **Category filtering** — one or more selected categories return only matching ducks; no categories means no filtering.
3. **Price filtering** — inclusive min/max bounds, with either side optional.
4. **Composition** — search + categories + price bounds all apply together using logical AND.
5. **Empty state** — a filtered result with zero matches renders `No duck matches your existential criteria.`
6. **Purity** — filtering and rendering do not mutate the input ducks or the caller-provided array.
7. **Regression coverage** — the existing catalog/render tests continue to pass with the adjusted empty-state parameter.

## Risks

- **Query normalization:** the spec says matching is case-insensitive, but the implementation must preserve the existing catalog order and not accidentally reorder the results.
- **Rendering copy drift:** the browse-catalog empty state and the search/filter empty state are similar but not identical. The optional `emptyMessage` parameter in `renderCatalog` keeps the behavior explicit without duplicating rendering logic.
- **Over-broad filtering:** the implementation must ensure that unspecified filters are treated as inactive rather than as a constraint that excludes everything.
