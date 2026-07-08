import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeJsonAtomic } from "./persist.js";

function tmpFile(): string {
  return join(mkdtempSync(join(tmpdir(), "persist-")), "value.json");
}

describe("writeJsonAtomic", () => {
  it("writes a new file whose content parses back deep-equal", () => {
    const file = tmpFile();
    const value = { ducks: [{ id: "a", stock: 3 }], total: 4.99 };
    writeJsonAtomic(file, value);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(value);
  });

  it("overwrites an existing file", () => {
    const file = tmpFile();
    writeFileSync(file, "old content");
    writeJsonAtomic(file, [1, 2, 3]);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual([1, 2, 3]);
  });

  it("ends the file with a newline and indents with two spaces", () => {
    const file = tmpFile();
    writeJsonAtomic(file, { key: "value" });
    const raw = readFileSync(file, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toContain('\n  "key"');
  });

  it("leaves no .tmp file behind", () => {
    const file = tmpFile();
    writeJsonAtomic(file, []);
    expect(existsSync(`${file}.tmp`)).toBe(false);
    expect(existsSync(file)).toBe(true);
  });
});
