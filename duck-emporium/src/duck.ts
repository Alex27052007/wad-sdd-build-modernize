export interface Duck {
  id: string;
  name: string;
  category: string;
  price: number; // euros, non-negative, at most two decimal places
  tagline: string;
  inStock: boolean;
}

const STRING_FIELDS = ["id", "name", "category", "tagline"] as const;
const NON_EMPTY_FIELDS = ["id", "name"] as const;

function fail(context: string, problem: string): never {
  throw new TypeError(`${context}: ${problem}`);
}

export function assertDuck(
  value: unknown,
  context: string,
): asserts value is Duck {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(context, "duck must be an object");
  }
  const record = value as Record<string, unknown>;

  for (const field of STRING_FIELDS) {
    if (typeof record[field] !== "string") {
      fail(context, `"${field}" must be a string`);
    }
  }
  for (const field of NON_EMPTY_FIELDS) {
    if ((record[field] as string).trim() === "") {
      fail(context, `"${field}" must not be empty`);
    }
  }

  const price = record["price"];
  if (typeof price !== "number" || !Number.isFinite(price)) {
    fail(context, `"price" must be a finite number`);
  }
  if (price < 0) {
    fail(context, `"price" must not be negative`);
  }
  if (Math.round(price * 100) / 100 !== price) {
    fail(context, `"price" must have at most two decimal places`);
  }

  if (typeof record["inStock"] !== "boolean") {
    fail(context, `"inStock" must be a boolean`);
  }
}
