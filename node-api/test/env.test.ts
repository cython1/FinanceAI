import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findEnvFile } from "../src/env.js";

describe("findEnvFile", () => {
  it("finds the repo-root .env from a service folder", () => {
    const root = mkdtempSync(join(tmpdir(), "fai-"));
    const service = join(root, "node-api");
    mkdirSync(service);
    writeFileSync(join(root, ".env"), "PORT=3000\n");
    expect(findEnvFile(service)).toBe(join(root, ".env"));
  });

  it("returns undefined when there is no .env nearby", () => {
    const dir = mkdtempSync(join(tmpdir(), "fai-"));
    expect(findEnvFile(dir, 0)).toBeUndefined();
  });
});
