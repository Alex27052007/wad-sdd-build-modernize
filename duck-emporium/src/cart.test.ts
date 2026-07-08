import { describe, expect, it } from "vitest";
import {
  EMPTY_CART,
  addToCart,
  removeFromCart,
  setQuantity,
  type Cart,
} from "./cart.js";
import type { Duck } from "./duck.js";

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
