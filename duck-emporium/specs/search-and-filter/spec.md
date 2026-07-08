# Spec: Search and filter the catalog (`search-and-filter`)

**Source story:** `../user-stories/05-search-and-filter.md`
**Depends on:** `duck-detail`
**Status:** Draft — awaiting approval

## Problem

Customers can browse and inspect ducks, but the catalog is still difficult to navigate when they have specific requirements such as “a philosophical duck under €20”. Without a search-and-filter layer, customers must scan the whole catalog manually, which is frustrating and makes the store feel less useful.

This story adds a pure filtering layer over the existing duck catalog so customers can quickly narrow a catalog view by free-text search, category, and price range.

## Users

- **Quincy Quacker (customer):** wants to find ducks that match specific needs quickly.
- **Later stories / other code (indirect):** the web frontend (story 9) will expose these filters in a UI; the catalog rendering code can reuse the same filtering semantics.

## Scope

### In scope

- A pure filtering helper over the existing duck catalog.
- Support for free-text search against duck name, tagline, and long description.
- Support for filtering by one or more categories.
- Support for filtering by minimum and/or maximum price, with either bound optional.
- Composition of all enabled filters with logical AND semantics.
- A friendly empty-state rendering for zero matches.
- Unit tests covering matching, filtering, composition, and the empty state.

### Out of scope

- Fuzzy or typo-tolerant search.
- Saved searches or search history.
- Sorting beyond the existing stable default order.
- Any UI or HTTP layer; this remains a library-level feature until story 9.

## Functional requirements

### FR1 — Search query

- A free-text query is applied case-insensitively.
- Matching is against the duck's `name`, `tagline`, and `description` fields.
- Matching is substring-based (for example, `philosoph` matches `Philosophical Duck`).
- An empty or whitespace-only query is treated as “no search term provided” and does not exclude matches.

### FR2 — Category filter

- The caller can provide one or more category values.
- A duck matches the category filter when its `category` is equal to any of the selected values.
- Matching is case-insensitive.
- If no categories are provided, the category filter is inactive.

### FR3 — Price filter

- The caller can provide a minimum price and/or a maximum price.
- Each bound is inclusive.
- Either bound may be omitted.
- If no price bounds are provided, the price filter is inactive.

### FR4 — Filter composition

- If multiple filters are enabled, a duck must satisfy all enabled filters to be included.
- In other words, the behavior is:
  - search query AND
  - category filter AND
  - price filter

### FR5 — Empty result rendering

- When a filter combination yields no matches, the catalog rendering returns a friendly empty-state message:
  - `No duck matches your existential criteria.`
- The empty state must be explicit and not render as a blank page.

### FR6 — Existing catalog behavior

- The story reuses the existing duck catalog and duck model from story 2.
- The default catalog ordering remains the stable seed-file order.
- Filtering does not mutate the input catalog or duck records.

## Non-functional requirements

- **NFR1 — Stack:** TypeScript, ES modules, Node 20+, `node:`-prefixed built-ins only; no new runtime dependencies.
- **NFR2 — Tests:** Vitest tests live next to source as `*.test.ts` and cover the matching and empty-state behavior.
- **NFR3 — Purity:** Filtering and rendering are pure functions over input data; only seed loading (if used by default) touches I/O.

## Acceptance criteria

1. A free-text search matches duck `name`, `tagline`, and `description` case-insensitively.
2. Filtering by one or more categories returns only ducks whose category matches the selected values.
3. Filtering by minimum and/or maximum price returns only ducks within the requested range.
4. A combination of search text, category selection, and price bounds applies all filters together with AND semantics.
5. An empty result set renders the friendly empty-state message `No duck matches your existential criteria.`
6. No existing catalog or duck data is mutated by filtering or rendering.
7. The full test suite passes via `npm test`.

## Open questions

- **Category matching semantics:** should category matching be exact text match or support normalized aliases (for example, `philosophy` vs `philosophical`)? Default assumption: exact, case-insensitive match.
- **Price formatting:** the price filter should work on numeric values; rendering continues to use the existing currency formatting from the catalog/detail stories.
