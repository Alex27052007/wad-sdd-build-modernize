import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assertDuck, type Duck } from "./duck.js";
import { writeJsonAtomic } from "./persist.js";

/** Absolute path to the default seed, resolved relative to this module,
 *  not the process CWD. */
export const DEFAULT_SEED_PATH = fileURLToPath(
  new URL("../data/ducks.json", import.meta.url),
);

export class CatalogLoadError extends Error {
  constructor(filePath: string, problem: string, options?: ErrorOptions) {
    super(`Failed to load catalog from ${filePath}: ${problem}`, options);
    this.name = "CatalogLoadError";
  }
}

export interface DuckFilters {
  query?: string;
  categories?: string[];
  minPrice?: number;
  maxPrice?: number;
}

/** Returns a new array containing only ducks that satisfy all enabled
 *  filters. The input catalog is never mutated. */
export function filterDucks(ducks: Duck[], filters: DuckFilters = {}): Duck[] {
  const query = filters.query?.trim().toLowerCase();
  const categories = (filters.categories ?? [])
    .map((category) => category.trim().toLowerCase())
    .filter((category) => category.length > 0);

  return ducks.filter((duck) => {
    if (query) {
      const haystack = [duck.name, duck.tagline, duck.description]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (categories.length > 0) {
      const category = duck.category.trim().toLowerCase();
      if (!categories.includes(category)) {
        return false;
      }
    }

    if (filters.minPrice !== undefined && duck.price < filters.minPrice) {
      return false;
    }

    if (filters.maxPrice !== undefined && duck.price > filters.maxPrice) {
      return false;
    }

    return true;
  });
}

/** Reads and validates a seed file. Throws CatalogLoadError naming the
 *  file and the specific problem (missing file, invalid JSON, not an
 *  array, bad record, duplicate id). An empty array is valid. */
export function loadCatalog(filePath: string = DEFAULT_SEED_PATH): Duck[] {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (cause) {
    throw new CatalogLoadError(filePath, "cannot read file", { cause });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new CatalogLoadError(filePath, "invalid JSON", { cause });
  }

  if (!Array.isArray(parsed)) {
    throw new CatalogLoadError(filePath, "top-level value must be an array");
  }

  const seen = new Set<string>();
  parsed.forEach((record, index) => {
    try {
      assertDuck(record, `entry ${index}`);
    } catch (cause) {
      const problem = cause instanceof Error ? cause.message : String(cause);
      throw new CatalogLoadError(filePath, problem, { cause });
    }
    if (seen.has(record.id)) {
      throw new CatalogLoadError(filePath, `duplicate id "${record.id}"`);
    }
    seen.add(record.id);
  });

  return parsed as Duck[];
}

/** Persists the catalog atomically (write-temp-then-rename). Records are
 *  written as given — callers pass loaded records with updated stock, so
 *  fields unknown to this module survive a round-trip. */
export function saveCatalog(
  catalog: Duck[],
  filePath: string = DEFAULT_SEED_PATH,
): void {
  writeJsonAtomic(filePath, catalog);
}

/** All ducks in catalog order, including out-of-stock ones. With no
 *  argument, loads from DEFAULT_SEED_PATH (no caching). Returns a copy so
 *  callers can't mutate the catalog. */
export function listDucks(catalog?: Duck[]): Duck[] {
  return [...(catalog ?? loadCatalog())];
}

/** Exact, case-sensitive match on id. undefined = no such duck (an
 *  expected outcome, not an exception; maps to HTTP 404 in story 9).
 *  Catalog injectable like listDucks; when omitted, loads the default
 *  seed. */
export function getDuckById(id: string, catalog?: Duck[]): Duck | undefined {
  return (catalog ?? loadCatalog()).find((duck) => duck.id === id);
}
