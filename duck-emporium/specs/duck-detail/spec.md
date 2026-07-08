# Spec: View a duck's detail page (`duck-detail`)

**Source story:** `../user-stories/02-duck-detail.md`
**Depends on:** `browse-catalog`
**Status:** Draft — awaiting approval

## Problem

Customers can browse the catalog (story 1) but see only a one-line summary
per duck. There is no way to look up a single duck and read its full story —
backstory, personality traits, special powers, or how many are left. This
story adds the detail lookup and, in doing so, evolves the duck model: the
scarcity label "Only 2 left" requires a stock *quantity*, which supersedes
story 1's `inStock` boolean.

## Users

- **Quincy Quacker (customer):** wants the full picture of a specific duck
  before committing to a purchase.
- **Later stories (indirect):** add-to-cart (story 3) will need the id-based
  lookup and the numeric stock; the web frontend (story 9) will render the
  detail view from this module.

## Scope

### In scope

- Extending the `Duck` model with `description` (long text), `traits`
  (string list), and `powers` (string list).
- **Model migration:** replacing `inStock: boolean` with `stock: number`
  (units in inventory, `0` = sold out). This touches story 1's deliverables:
  `src/duck.ts`, its tests, the seed data, and the catalog renderer. The
  browse-catalog spec/plan/tasks documents are superseded on this point and
  are not retro-edited.
- Lookup of a single duck by id.
- A stock-level label derived from the quantity ("In stock" / "Only N left"
  / "Sold out").
- A plain-text detail renderer, including a friendly "duck not found"
  rendering for unknown ids.
- Including each duck's `id` in the catalog list rendering, so the list
  refers to detail lookups by id (story AC3).
- Enriching the seed data with the new fields for every duck.

### Out of scope

- Customer reviews (per the story).
- "Related ducks" suggestions (per the story).
- HTTP endpoints/404s — still library-only until story 9; this spec defines
  the semantics the HTTP layer will later map (unknown id → 404).
- Decrementing stock (that's purchasing behavior — stories 3/4).

## Functional requirements

### FR1 — Extended duck model

The `Duck` record from browse-catalog gains/changes these fields:

| Field | Type | Notes |
|---|---|---|
| `stock` | `number` | **Replaces `inStock`.** Non-negative integer count of units in inventory; `0` = sold out. |
| `description` | `string` | Long-form backstory. Non-empty. |
| `traits` | `string[]` | Personality traits. At least one, each non-empty. |
| `powers` | `string[]` | Special powers. May be empty (not every duck is gifted); entries non-empty. |

`id`, `name`, `category`, `price`, `tagline` are unchanged. The runtime
validator (`assertDuck`) enforces the new rules.

### FR2 — Seed data migration

- Every duck in `data/ducks.json` carries the new fields with real content
  (no placeholder text like "TODO" or "lorem ipsum").
- `inStock: true` records become a positive `stock`; the previously
  out-of-stock duck becomes `stock: 0`.
- At least one seed duck has stock in the 1–3 range, so the "Only N left"
  label is exercised by real data.

### FR3 — Lookup by id

- `getDuckById(id, catalog?)` returns the matching `Duck`, or `undefined`
  when no duck has that id. Unknown ids are an expected outcome, not an
  exception.
- Matching is exact on the `id` string (case-sensitive; ids are lowercase
  slugs by convention).
- Like `listDucks`, the catalog argument is injectable; when omitted, the
  default seed is loaded.

### FR4 — Stock label

`stockLabel(stock)` maps quantity to display text:

| `stock` | Label |
|---|---|
| `0` | `Sold out` |
| `1`–`3` | `Only N left` (e.g. `Only 2 left`) |
| `≥ 4` | `In stock` |

### FR5 — Detail rendering

- `renderDuckDetail(duck)` returns multi-line plain text containing: name,
  category, formatted price (existing `formatPrice`), tagline, description,
  traits, powers, and the stock label.
- A duck with no powers renders gracefully (the powers line says e.g.
  `Powers: none` rather than dangling empty).
- `renderDuckDetail(undefined)` returns a friendly not-found message (e.g.
  "This duck has waddled off — no duck with that id."), never an empty
  string. This is the library-level analogue of the story's 404/error page.

### FR6 — Catalog list refers by id

`renderCatalog` (story 1) is updated so each duck's line includes its `id`,
making the id the visible key a reader uses for a detail lookup.

## Non-functional requirements

- **NFR1 — Stack:** unchanged — TypeScript ES modules, Node 20+, `node:`
  built-ins only, no new runtime dependencies.
- **NFR2 — Tests:** Vitest, `*.test.ts` next to source; existing story-1
  tests are updated for the model migration, not deleted.
- **NFR3 — Purity:** lookup, label, and rendering are pure; only seed
  loading touches I/O (as in story 1).

## Acceptance criteria

1. `getDuckById` with a valid id returns the full record including
   `description`, `traits`, `powers`, and numeric `stock`.
2. `getDuckById` with an unknown or malformed id returns `undefined`, and
   `renderDuckDetail(undefined)` yields the friendly not-found message.
3. `stockLabel`: `0 → "Sold out"`, `2 → "Only 2 left"`, `3 → "Only 3 left"`,
   `4 → "In stock"`.
4. `renderDuckDetail` output contains name, category, formatted price,
   tagline, description, every trait, every power (or the explicit
   no-powers form), and the stock label.
5. Every seed duck passes the extended validator; at least one has
   `stock: 0` and at least one has stock 1–3.
6. `renderCatalog` lines include each duck's `id`.
7. The full suite (`npm test`) passes, including the migrated story-1 tests
   (no remaining references to `inStock`).

## Open questions

- **Trait/power vocabulary:** free-form strings for now. Should the
  personality quiz (story 8) later need a controlled vocabulary, that story
  owns the migration.
- **Label wording for stock 1:** "Only 1 left" is grammatically fine — but
  should it be something more dramatic ("Last duck!")? Default: plain
  "Only 1 left" unless told otherwise.
