import { getDuckById, listDucks } from "./catalog.js";
import type { Duck } from "./duck.js";

export interface CartLine {
  duckId: string; // references Duck.id; at most one line per duck id
  quantity: number; // positive integer (≥ 1); 0 is never stored
}

/** Ordered list; insertion order preserved, quantity edits don't reorder. */
export type Cart = readonly CartLine[];

export const EMPTY_CART: Cart = [];

/** Discriminated result for expected failures: over-stock, unknown id,
 *  bad quantity. On failure the input cart is untouched. */
export type CartResult =
  | { ok: true; cart: Cart }
  | { ok: false; message: string };

/** quantity defaults to 1; must be a positive integer. Unknown duckId,
 *  bad quantity, or merged total > duck.stock → { ok: false, message }
 *  with the duck's name and available stock in the message. Merges into
 *  an existing line (position kept). Catalog injectable like getDuckById;
 *  omitted → default seed. */
export function addToCart(
  cart: Cart,
  duckId: string,
  quantity: number = 1,
  catalog?: Duck[],
): CartResult {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return {
      ok: false,
      message: `Quantity must be a positive whole number, got ${quantity}.`,
    };
  }
  const duck = getDuckById(duckId, catalog ?? listDucks());
  if (duck === undefined) {
    return { ok: false, message: `No duck with id "${duckId}".` };
  }
  const existing = cart.find((line) => line.duckId === duckId);
  const merged = (existing?.quantity ?? 0) + quantity;
  if (merged > duck.stock) {
    return {
      ok: false,
      message: `Only ${duck.stock} of "${duck.name}" in stock.`,
    };
  }
  const next = existing
    ? cart.map((line) =>
        line.duckId === duckId ? { duckId, quantity: merged } : line,
      )
    : [...cart, { duckId, quantity }];
  return { ok: true, cart: next };
}

/** quantity 0 → removes the line (ok). Positive integer → replaces the
 *  line's quantity, same stock check as addToCart. No such line, or
 *  negative/non-integer quantity → { ok: false, message }. */
export function setQuantity(
  cart: Cart,
  duckId: string,
  quantity: number,
  catalog?: Duck[],
): CartResult {
  if (!Number.isInteger(quantity) || quantity < 0) {
    return {
      ok: false,
      message: `Quantity must be a non-negative whole number, got ${quantity}.`,
    };
  }
  const existing = cart.find((line) => line.duckId === duckId);
  if (existing === undefined) {
    return { ok: false, message: `No line item for duck id "${duckId}".` };
  }
  if (quantity === 0) {
    return { ok: true, cart: removeFromCart(cart, duckId) };
  }
  const duck = getDuckById(duckId, catalog ?? listDucks());
  if (duck === undefined) {
    return { ok: false, message: `No duck with id "${duckId}".` };
  }
  if (quantity > duck.stock) {
    return {
      ok: false,
      message: `Only ${duck.stock} of "${duck.name}" in stock.`,
    };
  }
  return {
    ok: true,
    cart: cart.map((line) =>
      line.duckId === duckId ? { duckId, quantity } : line,
    ),
  };
}

/** Idempotent: absent id returns an equivalent cart. Cannot fail, so it
 *  returns Cart directly rather than a CartResult. */
export function removeFromCart(cart: Cart, duckId: string): Cart {
  return cart.filter((line) => line.duckId !== duckId);
}

/** Σ quantity × price over current catalog prices; 0 for empty cart.
 *  Cent-safe: sums Math.round(price * 100) per unit, divides once at the
 *  end. A line whose duckId is missing from the catalog throws TypeError:
 *  carts are built through addToCart, which validates ids, so a missing
 *  duck here is a data-integrity/programmer error (or a catalog-edit race
 *  that checkout revalidation owns) — not user input to map to a result
 *  value. */
export function cartTotal(cart: Cart, catalog?: Duck[]): number {
  const ducks = catalog ?? listDucks();
  const cents = cart.reduce((sum, line) => {
    const duck = getDuckById(line.duckId, ducks);
    if (duck === undefined) {
      throw new TypeError(`cart line references unknown duck id "${line.duckId}"`);
    }
    return sum + Math.round(duck.price * 100) * line.quantity;
  }, 0);
  return cents / 100;
}
