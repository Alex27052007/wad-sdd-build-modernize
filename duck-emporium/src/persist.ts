import { renameSync, writeFileSync } from "node:fs";

/** Serializes as 2-space-indented JSON with a trailing newline (matching
 *  the seed file), writes to `<filePath>.tmp`, then renames over the
 *  target — so the target is never left half-written. */
export function writeJsonAtomic(filePath: string, value: unknown): void {
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmpPath, filePath);
}
