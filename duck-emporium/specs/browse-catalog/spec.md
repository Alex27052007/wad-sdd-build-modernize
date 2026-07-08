# Spec: Browse the duck catalog (`browse-catalog`)

**Source story:** `../user-stories/01-browse-catalog.md`
**Status:** Draft — awaiting approval

## Problem

Visitors to The Rubber Duck Emporium have no way to see what ducks exist
before deciding to buy. The application currently has no catalog at all: no
duck data model, no stored duck data, and no way to list ducks. This story
establishes the catalog as the foundation that later stories (duck detail,
cart, search/filter, web frontend) build on.

## Users

- **Quincy Quacker (customer):** wants to browse the full range of ducks at a
  glance to get a feel for the stock.
- **Later stories / other code (indirect):** the duck-detail, add-to-cart,
  search-and-filter, and web-frontend stories will consume the catalog module
  and data model defined here.

## Scope

### In scope

- A typed `Duck` data model.
- A catalog module (library only — no HTTP server, no UI) that:
  - loads the catalog from a JSON seed file on disk,
  - exposes a function to list all ducks,
  - exposes a function to render the catalog as plain text, including an
    explicit empty-state message.
- A seed JSON file with at least 10 ducks across at least 3 categories.
- Unit tests for listing, rendering, and the empty state.

### Out of scope

- HTTP server or endpoints (delivery mechanism arrives with the web-frontend
  story).
- Pagination (catalog is small — per the story).
- Images (text-only — per the story).
- Sorting and filtering controls (story 5).
- Mutating the catalog (adding/editing ducks is story 6).
- Real payments (always mocked in this project; not touched here at all).

## Functional requirements

### FR1 — Duck data model

Each duck record has:

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Stable unique identifier (slug, e.g. `captain-quackbeard`). Later stories reference ducks by this. |
| `name` | `string` | Display name. |
| `category` | `string` | Free-form category label (e.g. `pirate`, `classic`, `seasonal`). |
| `price` | `number` | Price in euros as a decimal number (e.g. `14.99`), at most two decimal places. |
| `tagline` | `string` | One-line description. |
| `inStock` | `boolean` | Availability flag. |

### FR2 — Seed data

- The catalog is stored in a JSON file checked into the repository.
- The seed contains **at least 10 ducks** spanning **at least 3 distinct
  categories**.
- Every seed record is valid per FR1; `id` values are unique.
- At least one seed duck is out of stock, so the flag is exercised by real
  data.

### FR3 — List ducks

- `listDucks()` returns all ducks from the catalog, **including**
  out-of-stock ducks (each carrying its `inStock` flag); callers decide how
  to present availability.
- The returned order is deterministic: seed-file order.
- An empty catalog yields an empty array (not an error).

### FR4 — Render catalog as text

- `renderCatalog(ducks)` returns a plain-text representation of the catalog.
- Each duck renders on one line showing at minimum: name, category, formatted
  price (derived from `price`), and tagline.
- For an empty list it returns an explicit empty-state message (e.g.
  "The pond is empty — no ducks in the catalog yet."), never an empty string.

### FR5 — Error handling

- A missing, unreadable, or structurally invalid seed file causes a
  descriptive error (which file, what was wrong) — not a silent empty
  catalog.

## Non-functional requirements

- **NFR1 — Stack:** TypeScript, ES modules, Node 20+; `node:`-prefixed
  built-ins only (e.g. `node:fs`). No new runtime dependencies for this
  story.
- **NFR2 — Tests:** Vitest tests live next to source as `*.test.ts` and cover
  every acceptance criterion below.
- **NFR3 — Purity:** Only the seed-file read touches I/O; listing and
  rendering are pure over loaded data, so tests can inject fixture catalogs
  without touching disk.

## Acceptance criteria

1. `listDucks()` on the seeded catalog returns ≥ 10 ducks spanning ≥ 3
   categories, in seed-file order.
2. Every returned duck has `id`, `name`, `category`, `price` (number),
   `tagline`, and `inStock`.
3. Out-of-stock ducks appear in the listing with `inStock: false`.
4. `renderCatalog()` output contains, for each duck, its name, category,
   formatted price, and tagline.
5. `renderCatalog([])` returns the explicit empty-state message; it is never
   blank.
6. Loading a missing or malformed seed file raises a descriptive error.
7. All tests pass via `vitest`.

## Open questions

- **Currency:** `price` implies a single implicit currency. Which
  symbol/format should `renderCatalog` use — `$4.99`, `4,99 €`, other?
  (Resolved during planning: `4,99 €`.)
- **Category vocabulary:** categories are free-form strings here. Should a
  fixed category list be introduced before story 5 (search & filter) relies
  on them?
- **Seed file location:** exact path (e.g. `data/ducks.json`) is left to the
  technical plan.
