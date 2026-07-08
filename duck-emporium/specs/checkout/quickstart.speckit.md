# Quickstart: Check out with a Mocked Payment

**Feature**: `checkout` | **Date**: 2026-07-08

A developer guide for using the checkout module — from installation to first order confirmation.

---

## Prerequisites

- Node 20+
- `npm install` run in `duck-emporium/`
- `src/cart.ts`, `src/catalog.ts`, `src/persist.ts`, `src/orders.ts`, `src/render.ts` all present

---

## Basic Usage

```ts
import { addToCart, EMPTY_CART } from "./src/cart.js";
import { checkout } from "./src/checkout.js";

// 1. Build a cart
const cartResult = addToCart(EMPTY_CART, "rubber-classic", 2);
if (!cartResult.ok) throw new Error(cartResult.message);
const cart = cartResult.cart;

// 2. Provide customer details (card is mocked — any non-empty string)
const details = {
  name: "Quincy Quacker",
  email: "quincy@ducks.example",
  address: "1 Duck Pond Lane",
  card: "4111 1111 1111 1111",
};

// 3. Checkout
const result = checkout(cart, details);

if (result.ok) {
  console.log("Order confirmed:", result.confirmation.order.id);
  console.log(result.confirmation.text);
  // result.cart === EMPTY_CART
} else {
  console.error("Checkout failed:", result.message);
}
```

---

## Handling Validation Failures

`checkout` returns `{ ok: false, message }` — it never throws for expected failures:

```ts
const result = checkout(cart, { name: "", email: "bad", address: "", card: "" });
// result.ok === false
// result.message contains "name" (first failing field)
```

Failure categories:

| Scenario | `message` contains |
|---|---|
| Blank `name` / `address` / `card` | field name |
| Invalid email | `"email"` |
| Empty cart | `"empty"` (illustrative — not contractual) |
| Duck out of stock | duck's name and available count |

---

## Injecting Paths (Tests / Staging)

Use `CheckoutOptions` to redirect file I/O away from `data/`:

```ts
import { mkdtempSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(tmpdir(), "checkout-test-"));
const catalogPath = join(dir, "ducks.json");
const ordersPath  = join(dir, "orders.json");

// Copy a fixture catalog
copyFileSync("data/ducks.json", catalogPath);

const result = checkout(cart, details, { catalogPath, ordersPath });
// data/ducks.json and data/orders.json are never touched
```

---

## Reading Back Orders

```ts
import { loadOrders } from "./src/orders.js";

const orders = loadOrders(); // reads data/orders.json
// Returns Order[] — empty array if file does not exist yet
```

---

## Rendering a Confirmation

`result.confirmation.text` is already rendered. To re-render an existing order:

```ts
import { renderOrderConfirmation } from "./src/render.js";

const text = renderOrderConfirmation(order);
console.log(text);
// Order #a1b2c3d4...
// Classic Rubber Duck × 2 @ $5.99 = $11.98
// Total: $11.98
```

---

## Running Tests

```bash
# All tests
cd duck-emporium && npm test

# Checkout tests only
npm test -- src/checkout.test.ts

# Type-check
npx tsc --noEmit
```

Tests use sandboxed temp directories and never write to `data/`.

---

## Security Notes

- **Card data is never persisted.** The `card` field is validated (non-empty) then discarded — it does not appear in `Order`, `data/orders.json`, or `data/ducks.json`.
- **No real payment provider.** Do not add Stripe, PayPal, or any external payment SDK. The mock always succeeds once validation passes.
- **Stock is decremented atomically** (write-temp-then-rename). A crash during the write leaves the original file intact.
