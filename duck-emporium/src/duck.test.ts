import { describe, expect, it } from "vitest";
import { assertDuck, type Duck } from "./duck.js";

const validDuck: Duck = {
  id: "captain-quackbeard",
  name: "Captain Quackbeard",
  category: "pirate",
  price: 14.99,
  tagline: "Terror of the seven bathtubs.",
  stock: 7,
  description:
    "Once the fiercest rubber pirate on the high seas of Lake Foam, " +
    "Captain Quackbeard retired to a quiet life of shelf duty.",
  traits: ["bold", "salty"],
  powers: ["squeaks that summon bubbles"],
};

describe("assertDuck", () => {
  it("accepts a valid duck", () => {
    expect(() => assertDuck(validDuck, "test duck")).not.toThrow();
  });

  it("accepts a price of zero and whole-euro prices", () => {
    expect(() => assertDuck({ ...validDuck, price: 0 }, "t")).not.toThrow();
    expect(() => assertDuck({ ...validDuck, price: 5 }, "t")).not.toThrow();
  });

  it("accepts zero stock and an empty powers list", () => {
    expect(() => assertDuck({ ...validDuck, stock: 0 }, "t")).not.toThrow();
    expect(() => assertDuck({ ...validDuck, powers: [] }, "t")).not.toThrow();
  });

  it.each([null, undefined, "duck", 42, ["not", "a", "duck"]])(
    "rejects non-object value %j",
    (value) => {
      expect(() => assertDuck(value, "entry 0")).toThrow(/entry 0/);
    },
  );

  it.each(["id", "name", "category", "tagline", "description"] as const)(
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

  it.each(["id", "name", "description"] as const)(
    "rejects an empty %s",
    (field) => {
      expect(() =>
        assertDuck({ ...validDuck, [field]: "  " }, "entry 2"),
      ).toThrow(`"${field}" must not be empty`);
    },
  );

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

  it.each(["3", 2.5, NaN, undefined, true])(
    "rejects non-integer stock %j",
    (stock) => {
      expect(() => assertDuck({ ...validDuck, stock }, "entry 6")).toThrow(
        'entry 6: "stock" must be an integer',
      );
    },
  );

  it("rejects negative stock", () => {
    expect(() => assertDuck({ ...validDuck, stock: -1 }, "entry 7")).toThrow(
      '"stock" must not be negative',
    );
  });

  it.each(["traits", "powers"] as const)(
    "rejects a missing or non-array %s",
    (field) => {
      expect(() =>
        assertDuck({ ...validDuck, [field]: undefined }, "entry 8"),
      ).toThrow(`entry 8: "${field}" must be an array`);
      expect(() =>
        assertDuck({ ...validDuck, [field]: "brave" }, "entry 8"),
      ).toThrow(`"${field}" must be an array`);
    },
  );

  it.each(["traits", "powers"] as const)(
    "rejects empty-string entries in %s",
    (field) => {
      expect(() =>
        assertDuck({ ...validDuck, [field]: ["fine", " "] }, "entry 9"),
      ).toThrow(`entry 9: "${field}" entries must be non-empty strings`);
      expect(() =>
        assertDuck({ ...validDuck, [field]: [7] }, "entry 9"),
      ).toThrow(`"${field}" entries must be non-empty strings`);
    },
  );

  it("rejects an empty traits array", () => {
    expect(() => assertDuck({ ...validDuck, traits: [] }, "entry 10")).toThrow(
      '"traits" must contain at least one trait',
    );
  });

  it("includes the caller-supplied context in every error", () => {
    expect(() => assertDuck({}, "ducks.json entry 9")).toThrow(
      /^ducks\.json entry 9: /,
    );
  });
});
