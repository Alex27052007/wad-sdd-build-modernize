import { describe, expect, it } from "vitest";
import { assertDuck, type Duck } from "./duck.js";

const validDuck: Duck = {
  id: "captain-quackbeard",
  name: "Captain Quackbeard",
  category: "pirate",
  price: 14.99,
  tagline: "Terror of the seven bathtubs.",
  inStock: true,
};

describe("assertDuck", () => {
  it("accepts a valid duck", () => {
    expect(() => assertDuck(validDuck, "test duck")).not.toThrow();
  });

  it("accepts a price of zero and whole-euro prices", () => {
    expect(() => assertDuck({ ...validDuck, price: 0 }, "t")).not.toThrow();
    expect(() => assertDuck({ ...validDuck, price: 5 }, "t")).not.toThrow();
  });

  it.each([null, undefined, "duck", 42, ["not", "a", "duck"]])(
    "rejects non-object value %j",
    (value) => {
      expect(() => assertDuck(value, "entry 0")).toThrow(/entry 0/);
    },
  );

  it.each(["id", "name", "category", "tagline"] as const)(
    "rejects a missing or non-string %s",
    (field) => {
      expect(() =>
        assertDuck({ ...validDuck, [field]: undefined }, "entry 1"),
      ).toThrow(new RegExp(`entry 1: "${field}" must be a string`));
      expect(() => assertDuck({ ...validDuck, [field]: 7 }, "entry 1")).toThrow(
        `"${field}" must be a string`,
      );
    },
  );

  it.each(["id", "name"] as const)("rejects an empty %s", (field) => {
    expect(() => assertDuck({ ...validDuck, [field]: "  " }, "entry 2")).toThrow(
      `"${field}" must not be empty`,
    );
  });

  it.each(["4.99", NaN, Infinity, undefined])(
    "rejects non-finite or non-number price %j",
    (price) => {
      expect(() => assertDuck({ ...validDuck, price }, "entry 3")).toThrow(
        'entry 3: "price" must be a finite number',
      );
    },
  );

  it("rejects a negative price", () => {
    expect(() => assertDuck({ ...validDuck, price: -1 }, "entry 4")).toThrow(
      '"price" must not be negative',
    );
  });

  it("rejects a price with more than two decimal places", () => {
    expect(() => assertDuck({ ...validDuck, price: 4.999 }, "entry 5")).toThrow(
      '"price" must have at most two decimal places',
    );
  });

  it("rejects a missing or non-boolean inStock", () => {
    expect(() =>
      assertDuck({ ...validDuck, inStock: undefined }, "entry 6"),
    ).toThrow('entry 6: "inStock" must be a boolean');
    expect(() => assertDuck({ ...validDuck, inStock: "yes" }, "entry 6")).toThrow(
      '"inStock" must be a boolean',
    );
  });

  it("includes the caller-supplied context in every error", () => {
    expect(() => assertDuck({}, "ducks.json entry 9")).toThrow(
      /^ducks\.json entry 9: /,
    );
  });
});
