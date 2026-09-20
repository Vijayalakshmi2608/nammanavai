import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const configPath = path.resolve(import.meta.dirname, "../vite.config.ts");

describe("Manus badge removal", () => {
  it("does not include the Manus runtime plugin that injects the badge", () => {
    const contents = fs.readFileSync(configPath, "utf8");

    expect(contents).not.toContain("vite-plugin-manus-runtime");
    expect(contents).not.toContain("vitePluginManusRuntime");
  });
});
