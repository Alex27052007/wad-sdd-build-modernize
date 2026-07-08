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
