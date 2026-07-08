# Feature Specification: Check out with a Mocked Payment

**Feature Branch**: `04-checkout`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "checkout — Story 4 from user-stories/04-checkout.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Happy-path checkout (Priority: P1)

A customer with a non-empty cart fills in their shipping name, email, address, and mocked card details, submits, and receives an order confirmation with a unique order ID, a per-item summary, and the total. The cart is cleared.

**Why this priority**: Core value of the feature — nothing else matters if a valid checkout cannot complete.

**Independent Test**: Can be fully tested by calling `checkout(cart, validDetails)` with a populated, in-stock cart and asserting that the returned confirmation carries a UUID order ID, each duck's name, quantities, and a correct total, while the returned cart is empty.

**Acceptance Scenarios**:

1. **Given** a cart with at least one in-stock duck, **When** `checkout` is called with valid name, email, address, and any non-empty card string, **Then** it returns `{ ok: true, confirmation: { orderId, items, total, … }, cart: [] }`.
2. **Given** a successful checkout, **When** the data files are read back (or a fresh `loadCatalog` is called), **Then** the order appears in `data/orders.json` and stock for every line item has been decremented by the purchased quantity.
3. **Given** a successful checkout, **Then** card details are absent from both `data/orders.json` and `data/ducks.json`.

---

### User Story 2 — Customer detail validation (Priority: P1)

A customer submits the checkout form with one or more missing or malformed fields; the system rejects the submission with a human-readable message that names the invalid field.

**Why this priority**: Blocks all checkout paths; must be solid before anything else can be trusted.

**Independent Test**: Call `checkout` with each field blank or with a bad email pattern and assert `{ ok: false, message }` where the message contains the field name.

**Acceptance Scenarios**:

1. **Given** a blank `name`, **When** `checkout` is called, **Then** it returns `{ ok: false, message }` and the message references "name".
2. **Given** an `email` without `@` or without a dot in the domain (e.g., `"notanemail"`, `"a@nodot"`, `"@domain.com"`), **When** `checkout` is called, **Then** it returns `{ ok: false, message }` and the message references "email".
3. **Given** a blank `address`, **When** `checkout` is called, **Then** it returns `{ ok: false, message }` referencing "address".
4. **Given** a blank `card`, **When** `checkout` is called, **Then** it returns `{ ok: false, message }` referencing "card".

---

### User Story 3 — Empty-cart rejection (Priority: P2)

A customer attempts to check out with an empty cart; the system returns a clear failure.

**Why this priority**: Important guard, but only triggered after validation passes — lower risk than validation.

**Independent Test**: Call `checkout([], validDetails)` and assert `{ ok: false, message }`.

**Acceptance Scenarios**:

1. **Given** an empty cart, **When** `checkout` is called with otherwise valid details, **Then** it returns `{ ok: false, message }` with a message indicating the cart is empty.

---

### User Story 4 — Stock revalidation at checkout (Priority: P2)

A customer checks out a cart that contains a duck whose stock has since been exhausted by another shopper; the system rejects the checkout, names the offending duck(s), and leaves all stock unchanged.

**Why this priority**: Prevents overselling. Must fire before any stock changes.

**Independent Test**: Set a duck's stock to 0 after it was added to the cart, call `checkout`, and assert failure with the duck's name and that no other duck's stock changed.

**Acceptance Scenarios**:

1. **Given** a cart where one line item's quantity exceeds current stock, **When** `checkout` is called, **Then** it returns `{ ok: false, message }` naming the out-of-stock duck, and no duck's stock changes.
2. **Given** the first of two sequential checkouts of the last copy of a duck, **When** both checkouts complete, **Then** the first returns `ok: true` and the second returns `{ ok: false, message }` (first-checkout-wins).
3. **Given** a cart referencing a duck ID that no longer exists, **When** `checkout` is called, **Then** it returns `{ ok: false, message }`.

---

### User Story 5 — Order confirmation rendering (Priority: P3)

A developer (or the web frontend) formats a completed order as human-readable plain text for display.

**Why this priority**: Display concern only; the data model is already correct at this point.

**Independent Test**: Call `renderOrderConfirmation(order)` and assert the returned string contains the order ID, each duck name, quantity, formatted unit price, line subtotal, and formatted total.

**Acceptance Scenarios**:

1. **Given** an order record, **When** `renderOrderConfirmation(order)` is called, **Then** the output string contains the order ID, one line per item (name, quantity, unit price, subtotal), and the formatted total using `formatPrice`.

---

### Edge Cases

- What happens when a cart contains the same duck listed twice (duplicate `duckId`)? Checkout should treat it correctly (sum quantities or reject as invalid input — document the chosen behaviour).
- What if `data/orders.json` does not yet exist on first checkout? It must be created automatically.
- What if the temp-file rename fails mid-write? The partially written file must not corrupt existing data; the original survives.
- What if `quantity` in a cart line is 0 or negative? Checkout should reject it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept a `checkout(cart, details, options?)` function as the single entry point for the checkout flow.
- **FR-002**: System MUST validate all four `CheckoutDetails` fields before any other step: `name` and `address` non-empty after trimming; `email` matching `name@domain.tld` (at least one char before `@`, domain with at least one dot and non-empty parts on both sides); `card` non-empty after trimming.
- **FR-003**: System MUST reject an empty cart with `{ ok: false, message }` before touching any data.
- **FR-004**: System MUST revalidate stock for every line item against the current catalog at checkout time; if any item is out-of-stock or the duck no longer exists, the whole checkout MUST fail and no stock MUST change.
- **FR-005**: System MUST decrement stock atomically (all-or-nothing within a single process call) and persist the updated catalog to `data/ducks.json` via a write-temp-then-rename strategy.
- **FR-006**: System MUST create an order record with fields: `id` (UUID via `node:crypto`), `items` (duckId, name, quantity, unit price), `total` (cent-safe), `createdAt` (ISO 8601), `customer` (name, email, address — **no card**).
- **FR-007**: System MUST append the order to `data/orders.json` (creating the file if absent) via write-temp-then-rename.
- **FR-008**: System MUST clear the cart on success, returning an empty cart as part of `{ ok: true, confirmation, cart: [] }`.
- **FR-009**: System MUST never store card details in any file or log.
- **FR-010**: File paths for orders and catalog MUST be injectable via an `options` object so tests can use temp directories without touching repo seed data.
- **FR-011**: System MUST provide `renderOrderConfirmation(order)` producing multi-line plain text with order ID, one line per item, and a formatted total consistent with `formatPrice`.
- **FR-012**: Payment is **always mocked** — any non-empty card string succeeds; no external payment provider MUST ever be called.

### Non-Functional Requirements

- **NFR-001**: Implementation MUST use TypeScript strict mode, ES modules, Node 20+, and `node:` built-in prefixes — no new runtime dependencies.
- **NFR-002**: All rejection paths, the atomicity guarantee, persistence round-trips, and the card-exclusion guarantee MUST be covered by Vitest tests in `checkout.test.ts` adjacent to `checkout.ts`.
- **NFR-003**: Validation, order construction, and rendering MUST be pure functions; file I/O MUST be confined to the persistence layer.
- **NFR-004**: The full test suite (`npm test`) MUST pass after implementation.

## Open Questions

- **Duplicate duck IDs in cart**: Should checkout sum quantities automatically or treat duplicate `duckId` entries as a programmer error and reject? (Current add-to-cart spec merges quantities — document if checkout inherits that assumption.)
- **Seed mutation**: Real checkouts mutate `data/ducks.json`; the pristine seed is only recoverable via git. Acceptable for the workshop scope — flag if a separate state-file approach is preferred.
- **Crash-window ordering**: Stock is persisted (step 5) before the order (step 6). A crash between the two writes loses the order but keeps the decrement. Acceptable at workshop scale — flag if stricter ordering is required.
- **Message wording**: Exact failure message phrasing is illustrative, not contractual; tests assert on essentials (field name, duck name) rather than exact strings.
