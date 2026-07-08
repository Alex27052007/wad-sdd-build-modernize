# Spec: Check out with a mocked payment (`checkout`)

**Source story:** `../user-stories/04-checkout.md`
**Depends on:** `add-to-cart`
**Status:** Draft — awaiting approval

## Problem

A customer can assemble a cart (story 3), but nothing turns it into an
order: stock is never decremented, nothing is recorded, and the customer
gets no confirmation. This story adds checkout — collect shipping and
mocked card details, revalidate the cart against current stock, atomically
decrement stock, persist an order record that survives restarts, clear the
cart, and hand back a confirmation. Payment is mocked end to end; no real
provider is ever involved.

## Users

- **Quincy Quacker (customer):** wants to submit shipping details, pay
  (pretend), and receive an order ID proving the flock is booked.
- **Later stories (indirect):** the web frontend (story 9) maps checkout
  results to HTTP responses; order history ("can come later") will read
  the persisted orders.

## Scope

### In scope

- A `checkout(cart, details, options?)` operation that, given a non-empty
  cart and customer details, performs the full submit sequence below.
- Customer detail validation: shipping name, email, address, and mocked
  card details.
- Stock revalidation of every line item at checkout time.
- Atomic stock decrement: all line items or none.
- A persisted order record (JSON file) with unique ID, line items, total,
  and timestamp — durable across process restarts.
- Persisting the decremented stock back to the catalog file so stock also
  survives restarts.
- Clearing the cart on success (an empty cart is part of the success
  result — cart values stay immutable).
- A plain-text order confirmation renderer (order ID + summary).

### Out of scope

- Real payment provider integration (per the story — no Stripe/PayPal/etc;
  see also the project rule: payments are MOCKED).
- Payment failure simulation — the mocked payment always succeeds; the
  only failure paths are validation and stock.
- Emails / notifications (per the story).
- Order history / order lookup by customer (per the story).
- HTTP endpoints — still library-only until story 9.
- Cross-process concurrency control (file locking). Atomicity is
  guaranteed within a single process call, matching the workshop runtime.

## Functional requirements

### FR1 — Customer details

`CheckoutDetails`:

| Field | Type | Validation |
|---|---|---|
| `name` | `string` | Non-empty after trimming. |
| `email` | `string` | Must match a conservative `name@domain.tld` pattern — at least one character before `@`, and a domain containing at least one dot with characters on both sides. |
| `address` | `string` | Non-empty after trimming. |
| `card` | `string` | Non-empty after trimming — any other string is accepted (mocked payment). |

### FR2 — Result values

`checkout` returns a discriminated result in the style of the cart
operations (add-to-cart FR2):

- success: `{ ok: true, confirmation: OrderConfirmation, cart: Cart }`
  where `cart` is the cleared (empty) cart;
- failure: `{ ok: false, message: string }` with a human-readable message;
  on failure nothing is decremented, nothing is persisted, and the input
  cart is unchanged.

Exceptions remain reserved for programmer/environment errors (unreadable
or corrupt data files), consistent with `CatalogLoadError`.

### FR3 — Submit sequence

On `checkout(cart, details, options?)`, in order:

1. **Validate details** (FR1). Any invalid field fails with a message
   naming the field.
2. **Reject an empty cart** with a message — there is nothing to order.
3. **Revalidate stock** for every line item against the current catalog:
   the duck must still exist and `quantity ≤ stock`. If any line fails,
   the whole checkout fails with a message naming the offending duck(s);
   no stock is changed.
4. **Mock payment** — always succeeds (card already validated as
   non-empty in step 1).
5. **Decrement stock atomically**: subtract each line's quantity from its
   duck's stock and persist the updated catalog. Either every line item's
   decrement is applied or none is — there is no partial state, including
   on validation failure part-way through.
6. **Create and persist the order record** (FR4).
7. **Return the confirmation** with the cleared cart.

### FR4 — Order record and persistence

- Order record fields:

  | Field | Type | Notes |
  |---|---|---|
  | `id` | `string` | `crypto.randomUUID()` (`node:crypto`). |
  | `items` | `OrderItem[]` | One per cart line: `duckId`, duck `name`, `quantity`, unit `price` at purchase time. |
  | `total` | `number` | Cent-safe sum, same arithmetic as `cartTotal`. |
  | `createdAt` | `string` | ISO 8601 timestamp (`new Date().toISOString()`). |
  | `customer` | object | `name`, `email`, `address`. Card details are **never** stored. |

- Orders are appended to `data/orders.json` (a JSON array; created on
  first order). Stock decrements are written back to `data/ducks.json`.
  Both writes go through a write-temp-file-then-rename step so a crash
  never leaves a half-written file.
- Both file paths are injectable via `options` (defaulting to the real
  data files), so tests run against temp directories and never touch the
  repo's seed data.
- Persisted orders and stock survive a process restart: a fresh process
  reading the files sees all prior orders and the decremented stock.

### FR5 — Order confirmation

- The success result includes the order record plus
  `renderOrderConfirmation(order)`: multi-line plain text containing the
  order ID, one line per item (name, quantity, unit price, line subtotal),
  and the formatted total, using the existing `formatPrice` — same style
  as `renderCart`.

## Non-functional requirements

- **NFR1 — Stack:** unchanged — TypeScript ES modules, Node 20+, `node:`
  built-ins only, no new runtime dependencies.
- **NFR2 — Tests:** Vitest, `*.test.ts` next to source. Cover every
  rejection path, the atomicity guarantee, persistence round-trips
  (write, re-read from disk), and that card data never reaches disk.
- **NFR3 — Purity boundaries:** validation, order construction, and
  rendering are pure; file I/O is confined to the persistence step, with
  injectable paths as in FR4.
- **NFR4 — Atomicity model:** single-process, sequential calls — the
  in-call all-or-nothing guarantee of FR3 step 5. Cross-process races are
  explicitly out of scope.

## Acceptance criteria

1. A valid checkout of a non-empty, in-stock cart returns `ok: true` with
   a confirmation containing a UUID order ID, per-item summary, and
   cent-safe total, plus an empty cart.
2. Missing/blank name, address, or card, and emails failing the
   `name@domain.tld` pattern (no `@`, no dot in domain, empty parts) each
   fail with `ok: false` and a message naming the field.
3. Checking out an empty cart fails with a clear message.
4. If any line item's quantity now exceeds stock (or its duck no longer
   exists), checkout fails, names the offending duck, and **no** duck's
   stock changes — including ducks on other, valid line items.
5. A successful checkout decrements stock for every line item by its
   quantity, and the new stock is persisted: re-reading the catalog file
   (or a fresh `loadCatalog`) shows the decremented values.
6. A successful checkout appends an order to the orders file with all FR4
   fields; re-reading the file returns the order (restart survival). Card
   details appear nowhere in either file.
7. Two sequential checkouts of the same last-in-stock duck: the first
   succeeds, the second fails the stock check (first checkout wins, per
   the add-to-cart spec).
8. `renderOrderConfirmation` output contains the order ID, each duck's
   name, quantity, formatted unit price, line subtotal, and the formatted
   total.
9. Tests use injected temp paths — `data/ducks.json` in the repo is
   untouched by the test suite.
10. The full suite (`npm test`) passes.

## Open questions

- **Seed mutation:** per the chosen persistence model, real checkouts
  mutate `data/ducks.json` in place — the pristine seed is only
  recoverable via git. Acceptable for the workshop; flag if a pristine
  seed + separate state file is preferred after all.
- **Crash between the two writes:** stock is persisted (step 5) before
  the order (step 6); a crash exactly between them loses the order but
  keeps the decrement. Deemed acceptable at workshop scale — say so if
  checkout should instead write both files before returning success in a
  stricter order.
- **Message wording:** exact failure phrasing is illustrative, not
  contractual — tests assert on essentials (field name, duck name,
  available count), consistent with the add-to-cart spec.
