import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CatalogLoadError,
  DEFAULT_SEED_PATH,
  getDuckById,
  listDucks,
  loadCatalog,
  saveCatalog,
} from "./catalog.js";
import { assertDuck, type Duck } from "./duck.js";

function fixtureDuck(overrides: Partial<Duck> = {}): Duck {
  return {
    id: "test-duck",
    name: "Test Duck",
    category: "classic",
    price: 4.99,
    tagline: "A duck for testing.",
    stock: 5,
    description: "A perfectly ordinary duck that exists only in tests.",
    traits: ["reliable"],
    powers: [],
    ...overrides,
  };
}

function writeSeed(value: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "ducks-"));
  const file = join(dir, "seed.json");
  writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
  return file;
}

describe("seed integrity (data/ducks.json)", () => {
  const seed = loadCatalog();

  it("has at least 10 ducks in at least 3 categories", () => {
    expect(seed.length).toBeGreaterThanOrEqual(10);
    expect(new Set(seed.map((d) => d.category)).size).toBeGreaterThanOrEqual(3);
  });

  it("has unique ids and every record passes assertDuck", () => {
    expect(new Set(seed.map((d) => d.id)).size).toBe(seed.length);
    for (const duck of seed) {
      expect(() => assertDuck(duck, duck.id)).not.toThrow();
    }
  });

  it("exercises every stock band: 0, 1, and 2-3", () => {
    expect(seed.some((d) => d.stock === 0)).toBe(true);
    expect(seed.some((d) => d.stock === 1)).toBe(true);
    expect(seed.some((d) => d.stock >= 2 && d.stock <= 3)).toBe(true);
  });

  it("carries no legacy inStock key", () => {
    expect(readFileSync(DEFAULT_SEED_PATH, "utf8")).not.toContain("inStock");
  });

  it("preserves file order", () => {
    const fileIds = (
      JSON.parse(readFileSync(DEFAULT_SEED_PATH, "utf8")) as Duck[]
    ).map((d) => d.id);
    expect(seed.map((d) => d.id)).toEqual(fileIds);
  });
});

describe("listDucks", () => {
  const ducks = [
    fixtureDuck({ id: "a", stock: 3 }),
    fixtureDuck({ id: "b", stock: 0 }),
    fixtureDuck({ id: "c", stock: 9 }),
  ];

  it("returns all ducks including out-of-stock, in catalog order", () => {
    expect(listDucks(ducks).map((d) => d.id)).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array for an empty catalog", () => {
    expect(listDucks([])).toEqual([]);
  });

  it("returns a copy: mutating the result does not affect a second call", () => {
    const first = listDucks(ducks);
    first.pop();
    expect(listDucks(ducks)).toHaveLength(3);
  });

  it("zero-arg form loads the real seed", () => {
    expect(listDucks().length).toBeGreaterThanOrEqual(10);
  });
});

describe("getDuckById", () => {
  const ducks = [fixtureDuck({ id: "sir-quack" }), fixtureDuck({ id: "jane" })];

  it("returns the full record for a known id", () => {
    expect(getDuckById("sir-quack", ducks)).toEqual(ducks[0]);
  });

  it.each(["nope", "Sir-Quack", "", "sir-quack "])(
    "returns undefined for unknown or mismatched id %j",
    (id) => {
      expect(getDuckById(id, ducks)).toBeUndefined();
    },
  );

  it("zero-arg form resolves against the real seed", () => {
    expect(getDuckById("captain-quackbeard")?.name).toBe("Captain Quackbeard");
  });
});

describe("saveCatalog", () => {
  it("save-then-loadCatalog round-trips exactly", () => {
    const file = join(mkdtempSync(join(tmpdir(), "ducks-")), "catalog.json");
    const ducks = [
      fixtureDuck({ id: "a", stock: 2 }),
      fixtureDuck({ id: "b", stock: 0 }),
    ];
    saveCatalog(ducks, file);
    expect(loadCatalog(file)).toEqual(ducks);
  });

  it("preserves fields unknown to this story across save/load-raw", () => {
    const file = join(mkdtempSync(join(tmpdir(), "ducks-")), "catalog.json");
    const withExtra = { ...fixtureDuck(), curator: "story-6" };
    saveCatalog([withExtra as Duck], file);
    const raw = JSON.parse(readFileSync(file, "utf8")) as unknown[];
    expect(raw).toEqual([withExtra]);
  });
});

describe("loadCatalog errors", () => {
  it("throws CatalogLoadError naming file and problem for a missing file", () => {
    const file = join(mkdtempSync(join(tmpdir(), "ducks-")), "missing.json");
    expect(() => loadCatalog(file)).toThrow(CatalogLoadError);
    expect(() => loadCatalog(file)).toThrow(file);
    expect(() => loadCatalog(file)).toThrow(/cannot read file/);
  });

  it("throws on invalid JSON", () => {
    const file = writeSeed("{ not json");
    expect(() => loadCatalog(file)).toThrow(CatalogLoadError);
    expect(() => loadCatalog(file)).toThrow(/invalid JSON/);
  });

  it("throws on a non-array root", () => {
    const file = writeSeed({ ducks: [] });
    expect(() => loadCatalog(file)).toThrow(/must be an array/);
  });

  it("throws on a record failing validation, naming the entry", () => {
    const file = writeSeed([fixtureDuck(), { ...fixtureDuck(), price: -1 }]);
    expect(() => loadCatalog(file)).toThrow(CatalogLoadError);
    expect(() => loadCatalog(file)).toThrow(/entry 1/);
    expect(() => loadCatalog(file)).toThrow(/"price" must not be negative/);
  });

  it("throws on a duplicate id", () => {
    const file = writeSeed([fixtureDuck({ id: "twin" }), fixtureDuck({ id: "twin" })]);
    expect(() => loadCatalog(file)).toThrow(/duplicate id "twin"/);
  });

  it("accepts an empty array", () => {
    expect(loadCatalog(writeSeed([]))).toEqual([]);
  });
});
