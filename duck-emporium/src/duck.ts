export interface Duck {
  id: string;
  name: string;
  category: string;
  price: number; // euros, non-negative, at most two decimal places
  tagline: string;
  stock: number; // units in inventory, non-negative integer, 0 = sold out
  description: string; // long-form backstory
  traits: string[]; // personality traits, at least one
  powers: string[]; // special powers, may be empty
}

const STRING_FIELDS = ["id", "name", "category", "tagline", "description"] as const;
const NON_EMPTY_FIELDS = ["id", "name", "description"] as const;

function fail(context: string, problem: string): never {
  throw new TypeError(`${context}: ${problem}`);
}

function assertStringArray(
  value: unknown,
  field: string,
  context: string,
): asserts value is string[] {
  if (!Array.isArray(value)) {
    fail(context, `"${field}" must be an array`);
  }
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim() === "") {
      fail(context, `"${field}" entries must be non-empty strings`);
    }
  }
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

  const stock = record["stock"];
  if (typeof stock !== "number" || !Number.isInteger(stock)) {
    fail(context, `"stock" must be an integer`);
  }
  if (stock < 0) {
    fail(context, `"stock" must not be negative`);
  }

  assertStringArray(record["traits"], "traits", context);
  if (record["traits"].length === 0) {
    fail(context, `"traits" must contain at least one trait`);
  }
  assertStringArray(record["powers"], "powers", context);
}
