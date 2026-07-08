# Tasks: Browse the duck catalog (`browse-catalog`)

**Source plan:** `specs/browse-catalog/plan.md`
**Status:** Draft — awaiting approval

## Task 1 — Duck model and validator

**Files:** `src/duck.ts`
**Depends on:** nothing

Create the `Duck` interface (id, name, category, price, tagline, inStock)
and the `assertDuck(value, context)` type guard exactly as specified in the
plan: all six fields present with correct primitive types, `price` a
non-negative finite number with at most two decimal places, non-empty
`id`/`name`, error messages that include `context`.

**Acceptance check:** `npx tsc --noEmit` passes. (Behavioral coverage of the
validator lands with Task 3's load-error tests.)

## Task 2 — Seed catalog data

**Files:** `data/ducks.json`
**Depends on:** nothing (record shape defined by Task 1, but this is pure
data and can be written first or in parallel)

Author the seed catalog: 12 ducks across 4 categories (e.g. `classic`,
`pirate`, `seasonal`, `professional`), unique slug ids, euro `price` values
with at most two decimals (e.g. `14.99`), one-line taglines, at least one
duck with `inStock: false`.

**Acceptance check:** `node -e "JSON.parse(require('node:fs').readFileSync('data/ducks.json','utf8'))"`
exits 0; visual check confirms ≥ 10 ducks, ≥ 3 categories, ≥ 1 out-of-stock.
(Machine-enforced by Task 3's seed-integrity test.)

## Task 3 — Catalog loading and listing, with tests

**Files:** `src/catalog.ts`, `src/catalog.test.ts`, `package.json`
**Depends on:** Task 1, Task 2

Implement `DEFAULT_SEED_PATH` (resolved via `import.meta.url`),
`loadCatalog(filePath?)`, `CatalogLoadError`, and `listDucks(catalog?)` per
the plan's public interfaces (copy semantics, out-of-stock included, empty
array valid). Set `package.json`'s test script to `vitest run`.

Tests (from the plan's testing strategy):
- Seed integrity against the real `data/ducks.json`: ≥ 10 ducks, ≥ 3
  categories, unique ids, all records pass validation, ≥ 1 out-of-stock,
  seed-file order preserved.
- Listing with injected fixtures: includes out-of-stock, preserves order,
  empty → empty array, returned array is a defensive copy.
- Load errors via `mkdtemp` temp files: missing file, invalid JSON,
  non-array root, invalid record, duplicate id — each throws
  `CatalogLoadError` naming the file and the problem.

**Acceptance check:** `npm test` passes with all catalog tests green
(spec AC1, AC2, AC3, AC6).

## Task 4 — Text rendering, with tests

**Files:** `src/render.ts`, `src/render.test.ts`
**Depends on:** Task 1 (needs only the `Duck` type; can be built in parallel
with Task 3, but its acceptance check uses the test script Task 3 adds)

Implement `formatPrice(price)` (`4,99 €` style — `toFixed(2)` with the dot
swapped for a comma; throws on negative or non-finite input) and
`renderCatalog(ducks)` (one line per duck with name, category, formatted
price, tagline; the explicit empty-state message for an empty list).

Tests:
- `formatPrice`: `0 → "0,00 €"`, `0.05 → "0,05 €"`, `4.99 → "4,99 €"`,
  `14.9 → "14,90 €"`, `1234.56 → "1234,56 €"`, negative or non-finite
  input throws.
- `renderCatalog`: each fixture duck's line contains name, category,
  formatted price, tagline; `renderCatalog([])` returns the empty-state
  message and is never an empty string.

**Acceptance check:** `npm test` passes with all render tests green
(spec AC4, AC5).

## Task 5 — Final acceptance sweep

**Files:** none expected (fixes only if a gap is found)
**Depends on:** Tasks 1–4

Run the full suite and walk spec acceptance criteria AC1–AC7 against the
implementation, confirming each is covered by a passing test. Fix any gap
found; otherwise this task produces no diff and needs no commit.

**Acceptance check:** `npm test` passes; every AC in
`specs/browse-catalog/spec.md` maps to at least one green test.

## Suggested commit order

1 → 2 → 3 → 4 → 5 (2 may swap with 1; 4 may follow 1 directly, in parallel
with 3).
