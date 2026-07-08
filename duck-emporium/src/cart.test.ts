import { describe, expect, it } from "vitest";
import {
  EMPTY_CART,
  addToCart,
  cartTotal,
  removeFromCart,
  setQuantity,
  type Cart,
} from "./cart.js";
import type { Duck } from "./duck.js";
import { renderCart } from "./render.js";

function fixtureDuck(overrides: Partial<Duck> = {}): Duck {
  return Object.freeze({
    id: "test-duck",
    name: "Test Duck",
    category: "classic",
    price: 4.99,
    tagline: "A duck for testing.",
    stock: 5,
    description: "A perfectly ordinary duck that exists only in tests.",
    traits: Object.freeze(["reliable"]) as unknown as string[],
    powers: Object.freeze([]) as unknown as string[],
    ...overrides,
  });
}

const sirQuack = fixtureDuck({
  id: "sir-quacksalot",
  name: "Sir Quacksalot",
  stock: 5,
  price: 4.99,
});
const rare = fixtureDuck({ id: "rare-duck", name: "Rare Duck", stock: 2 });
const soldOut = fixtureDuck({ id: "gone-duck", name: "Gone Duck", stock: 0 });

const catalog = Object.freeze([sirQuack, rare, soldOut]) as Duck[];

function frozenCart(...lines: { duckId: string; quantity: number }[]): Cart {
  return Object.freeze(lines.map((line) => Object.freeze({ ...line })));
}

describe("addToCart", () => {
  it("adds with quantity 1 when no quantity is given", () => {
    const result = addToCart(EMPTY_CART, "sir-quacksalot", undefined, catalog);
    expect(result).toEqual({
      ok: true,
      cart: [{ duckId: "sir-quacksalot", quantity: 1 }],
    });
  });

  it("adds with an explicit quantity", () => {
    const result = addToCart(EMPTY_CART, "sir-quacksalot", 3, catalog);
    expect(result).toEqual({
      ok: true,
      cart: [{ duckId: "sir-quacksalot", quantity: 3 }],
    });
  });

  it("merges a duplicate add into the existing line, keeping its position", () => {
    const cart = frozenCart(
      { duckId: "sir-quacksalot", quantity: 2 },
      { duckId: "rare-duck", quantity: 1 },
    );
    const result = addToCart(cart, "sir-quacksalot", 2, catalog);
    expect(result).toEqual({
      ok: true,
      cart: [
        { duckId: "sir-quacksalot", quantity: 4 },
        { duckId: "rare-duck", quantity: 1 },
      ],
    });
  });

  it("appends a different duck after existing lines", () => {
    const cart = frozenCart({ duckId: "sir-quacksalot", quantity: 1 });
    const result = addToCart(cart, "rare-duck", 1, catalog);
    expect(result.ok && result.cart.map((l) => l.duckId)).toEqual([
      "sir-quacksalot",
      "rare-duck",
    ]);
  });

  it("fails an add exceeding stock, naming the duck and available count", () => {
    const result = addToCart(EMPTY_CART, "rare-duck", 3, catalog);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Rare Duck");
      expect(result.message).toContain("2");
    }
  });

  it("fails a merge pushing the line above stock, leaving the cart unchanged", () => {
    const cart = frozenCart({ duckId: "rare-duck", quantity: 2 });
    const snapshot = structuredClone(cart);
    const result = addToCart(cart, "rare-duck", 1, catalog);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Rare Duck");
      expect(result.message).toContain("2");
    }
    expect(cart).toEqual(snapshot);
  });

  it("never adds a stock-0 duck", () => {
    const result = addToCart(EMPTY_CART, "gone-duck", 1, catalog);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Gone Duck");
      expect(result.message).toContain("0");
    }
  });

  it("fails on an unknown duck id", () => {
    const result = addToCart(EMPTY_CART, "no-such-duck", 1, catalog);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("no-such-duck");
    }
  });

  it.each([0, -1, 1.5, NaN])(
    "fails on invalid quantity %d with a non-empty message",
    (quantity) => {
      const result = addToCart(EMPTY_CART, "sir-quacksalot", quantity, catalog);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message.length).toBeGreaterThan(0);
      }
    },
  );

  it("zero-arg catalog form resolves against the real seed", () => {
    const result = addToCart(EMPTY_CART, "captain-quackbeard");
    expect(result.ok).toBe(true);
  });
});

describe("setQuantity", () => {
  const cart = frozenCart(
    { duckId: "sir-quacksalot", quantity: 2 },
    { duckId: "rare-duck", quantity: 1 },
  );

  it("replaces a line's quantity without reordering", () => {
    const result = setQuantity(cart, "sir-quacksalot", 4, catalog);
    expect(result).toEqual({
      ok: true,
      cart: [
        { duckId: "sir-quacksalot", quantity: 4 },
        { duckId: "rare-duck", quantity: 1 },
      ],
    });
  });

  it("removes the line on quantity 0", () => {
    const result = setQuantity(cart, "sir-quacksalot", 0, catalog);
    expect(result).toEqual({
      ok: true,
      cart: [{ duckId: "rare-duck", quantity: 1 }],
    });
  });

  it("fails above stock, naming the duck and available count, cart unchanged", () => {
    const snapshot = structuredClone(cart);
    const result = setQuantity(cart, "rare-duck", 3, catalog);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Rare Duck");
      expect(result.message).toContain("2");
    }
    expect(cart).toEqual(snapshot);
  });

  it("fails when the duck has no line item in the cart", () => {
    const snapshot = structuredClone(cart);
    const result = setQuantity(cart, "gone-duck", 1, catalog);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("gone-duck");
    }
    expect(cart).toEqual(snapshot);
  });

  it.each([-1, 2.5, NaN])(
    "fails on invalid quantity %d, cart unchanged",
    (quantity) => {
      const snapshot = structuredClone(cart);
      const result = setQuantity(cart, "sir-quacksalot", quantity, catalog);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message.length).toBeGreaterThan(0);
      }
      expect(cart).toEqual(snapshot);
    },
  );
});

describe("cartTotal", () => {
  const dime = fixtureDuck({
    id: "dime-duck",
    name: "Dime Duck",
    price: 0.1,
    stock: 10,
  });
  const priced = Object.freeze([sirQuack, rare, dime]) as Duck[];

  it("returns exactly 0 for the empty cart", () => {
    expect(cartTotal(EMPTY_CART, priced)).toBe(0);
  });

  it("sums quantity × price across multiple lines", () => {
    const cart = frozenCart(
      { duckId: "sir-quacksalot", quantity: 2 }, // 2 × 4.99 = 9.98
      { duckId: "rare-duck", quantity: 1 }, // 1 × 4.99 = 4.99
    );
    expect(cartTotal(cart, priced)).toBe(14.97);
  });

  it("is cent-safe: 3 × 0.10 € totals exactly 0.3", () => {
    const cart = frozenCart({ duckId: "dime-duck", quantity: 3 });
    expect(cartTotal(cart, priced)).toBe(0.3);
  });

  it("handles a single line with quantity > 1", () => {
    const cart = frozenCart({ duckId: "sir-quacksalot", quantity: 4 });
    expect(cartTotal(cart, priced)).toBe(19.96);
  });

  it("throws TypeError for a line whose duck is missing from the catalog", () => {
    const cart = frozenCart({ duckId: "vanished-duck", quantity: 1 });
    expect(() => cartTotal(cart, priced)).toThrow(TypeError);
    expect(() => cartTotal(cart, priced)).toThrow(/vanished-duck/);
  });
});

describe("removeFromCart", () => {
  const cart = frozenCart(
    { duckId: "sir-quacksalot", quantity: 2 },
    { duckId: "rare-duck", quantity: 1 },
  );

  it("removes a present line item", () => {
    expect(removeFromCart(cart, "sir-quacksalot")).toEqual([
      { duckId: "rare-duck", quantity: 1 },
    ]);
  });

  it("is idempotent: an absent id yields an equivalent cart", () => {
    expect(removeFromCart(cart, "not-in-cart")).toEqual(cart);
  });
});

describe("purity", () => {
  it("a full operation sequence never mutates carts, catalog, or stock", () => {
    const catalogSnapshot = structuredClone(catalog);

    const afterAdd = addToCart(EMPTY_CART, "sir-quacksalot", 2, catalog);
    if (!afterAdd.ok) throw new Error("add failed");
    const addSnapshot = structuredClone(afterAdd.cart);

    const afterSecondAdd = addToCart(afterAdd.cart, "rare-duck", 1, catalog);
    if (!afterSecondAdd.ok) throw new Error("second add failed");
    expect(afterAdd.cart).toEqual(addSnapshot);
    const secondSnapshot = structuredClone(afterSecondAdd.cart);

    const afterSet = setQuantity(afterSecondAdd.cart, "rare-duck", 2, catalog);
    if (!afterSet.ok) throw new Error("setQuantity failed");
    expect(afterSecondAdd.cart).toEqual(secondSnapshot);
    const setSnapshot = structuredClone(afterSet.cart);

    cartTotal(afterSet.cart, catalog);
    renderCart(afterSet.cart, catalog);
    removeFromCart(afterSet.cart, "sir-quacksalot");
    expect(afterSet.cart).toEqual(setSnapshot);

    expect(catalog).toEqual(catalogSnapshot);
    expect(catalog.map((duck) => duck.stock)).toEqual(
      catalogSnapshot.map((duck) => duck.stock),
    );
  });

  it("EMPTY_CART stays empty after being used as an input", () => {
    addToCart(EMPTY_CART, "sir-quacksalot", 1, catalog);
    expect(EMPTY_CART).toEqual([]);
  });
});
