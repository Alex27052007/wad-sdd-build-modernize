# Tasks: View a duck's detail page (`duck-detail`)

**Source plan:** `specs/duck-detail/plan.md`
**Status:** Draft — awaiting approval

Note on cross-story scope: per the plan, these tasks also deliver the
still-unbuilt remainder of browse-catalog (its tasks 2–5) directly against
the migrated model. Completing this list completes both stories.

## Task 1 — Migrate the Duck model and validator

**Files:** `src/duck.ts`, `src/duck.test.ts`
**Depends on:** nothing (browse-catalog task 1 is already implemented and
green; this migrates it)

Replace `inStock: boolean` with `stock: number` and add `description`,
`traits`, `powers` per the plan's data model. Extend `assertDuck`: `stock`
a non-negative integer; `description` a non-empty string; `traits` a
non-empty array of non-empty strings; `powers` a (possibly empty) array of
non-empty strings. Migrate existing tests off `inStock` and add rejection
cases: negative/fractional `stock`, empty `description`, empty `traits`
array, empty string inside `traits` or `powers`.

**Acceptance check:** `npx tsc --noEmit` passes and `npx vitest run` is
green with zero remaining `inStock` references (`grep -r inStock src/`
finds nothing).

## Task 2 — Author the full seed catalog

**Files:** `data/ducks.json`
**Depends on:** Task 1 (record shape)

Write 12 ducks across 4 categories (e.g. `classic`, `pirate`, `seasonal`,
`professional`): unique slug ids, euro prices with ≤ 2 decimals, one-line
taglines, real (non-placeholder) descriptions, ≥ 1 trait each, powers where
flavor allows (at least one duck with an empty `powers` list). Stock
spread: at least one duck with `stock: 0`, one with `stock: 1`, one with
stock 2–3, rest ≥ 4.

**Acceptance check:** `node --input-type=module -e "import('node:fs').then(fs => JSON.parse(fs.readFileSync('data/ducks.json','utf8')))"`
exits 0; visual check of the counts above. (Machine-enforced by Task 3's
seed-integrity test.)

## Task 3 — Catalog module: load, list, lookup

**Files:** `src/catalog.ts`, `src/catalog.test.ts`, `package.json`
**Depends on:** Tasks 1 and 2

Implement `DEFAULT_SEED_PATH` (via `import.meta.url`), `loadCatalog`,
`CatalogLoadError`, `listDucks` (per the browse-catalog plan: defensive
copy, seed order, out-of-stock included) and `getDuckById` (exact
case-sensitive match, `undefined` for unknown ids, injectable catalog, no
caching on the zero-arg form). Set `package.json` test script to
`vitest run`.

Tests: seed integrity (≥ 10 ducks, ≥ 3 categories, unique ids, all pass
`assertDuck`, ≥ 1 duck at stock 0 / 1 / 2–3 each, no `inStock` key, file
order preserved); listing behaviors with injected fixtures; lookup (known
id full record; unknown id, wrong case, empty string → `undefined`);
load errors via `mkdtemp` temp files (missing file, invalid JSON,
non-array root, invalid record, duplicate id → `CatalogLoadError` naming
file and problem).

**Acceptance check:** `npm test` green (browse-catalog AC1–AC3, AC6;
duck-detail AC1, AC2-lookup, AC5).

## Task 4 — Rendering: catalog lines, price, stock label, detail view

**Files:** `src/render.ts`, `src/render.test.ts`
**Depends on:** Task 1 (Duck type); runs after Task 3 in practice (its
check uses the `npm test` script Task 3 adds; fixtures make it otherwise
independent)

Implement `formatPrice` (`4,99 €` — `toFixed(2)`, dot→comma; throws on
negative/non-finite), `renderCatalog` (one line per duck **starting with
the id**, then name, category, formatted price, tagline; explicit
empty-state message for `[]`), `stockLabel` (`0 → "Sold out"`,
`1 → "Last duck!"`, `2–3 → "Only N left"`, `≥ 4 → "In stock"`; throws on
negative/non-integer), and `renderDuckDetail` (multi-line: name, category,
formatted price, tagline, description, traits, powers with `Powers: none`
when empty, stock label; `undefined` → friendly not-found message, never
empty).

Tests: `formatPrice` cases from the browse-catalog plan; catalog line
contents incl. id and the empty state; the full `stockLabel` table incl.
error cases; detail rendering incl. `Powers: none` and the not-found
message.

**Acceptance check:** `npm test` green (browse-catalog AC4–AC5;
duck-detail AC2-render, AC3, AC4, AC6).

## Task 5 — Final acceptance sweep, both stories

**Files:** none expected (fixes only if a gap is found)
**Depends on:** Tasks 1–4

Run the full suite and walk every acceptance criterion in
`specs/browse-catalog/spec.md` (as amended by the supersession notes) and
`specs/duck-detail/spec.md`, confirming each maps to a green test.

**Acceptance check:** `npm test` passes; all ACs of both stories covered.

## Suggested commit order

1 → 2 → 3 → 4 → 5, one commit per task. Task 4 may start after Task 1 if
worked in parallel, but commits should land in numbered order.
