import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

/**
 * Finds the .env shared by every service: the nearest one at or above `start`
 * (node-api runs from node-api/, the file lives at the repo root).
 */
export function findEnvFile(
  start: string = process.cwd(),
  maxLevels = 3,
): string | undefined {
  let dir = resolve(start);
  for (let level = 0; level <= maxLevels; level++) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/** Loads the shared .env into process.env. Variables already set (e.g. in a container) win. */
export function loadEnvFile(): string | undefined {
  const path = findEnvFile();
  if (path) loadDotenv({ path, quiet: true });
  return path;
}
