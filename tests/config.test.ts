import { describe, it, expect } from "vitest";
import { resolveConfig, loadConfigFile, findConfig } from "../src/engine/config.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

describe("resolveConfig", () => {
  it("loads default preset with non-empty banned vocab", () => {
    const cfg = resolveConfig({ preset: "default" });
    expect(cfg.bannedVocab.has("delve")).toBe(true);
    expect(cfg.bannedVocab.has("leverage")).toBe(true);
  });

  it("turns off banned vocab when preset is off", () => {
    const cfg = resolveConfig({ preset: "off" });
    expect(cfg.bannedVocab.size).toBe(0);
  });

  it("merges user banned vocab on top of preset", () => {
    const cfg = resolveConfig({ preset: "default", bannedVocab: ["widget"] });
    expect(cfg.bannedVocab.has("widget")).toBe(true);
  });

  it("subtracts allowedVocab from the banned set", () => {
    const cfg = resolveConfig({ preset: "default", allowedVocab: ["robust"] });
    expect(cfg.bannedVocab.has("robust")).toBe(false);
  });

  it("loads CTI preset with extra CTI words", () => {
    const cfg = resolveConfig({ preset: "cti" });
    expect(cfg.bannedVocab.has("sophisticated")).toBe(true);
  });
});

describe("findConfig + loadConfigFile", () => {
  it("walks upward and loads a YAML file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "antislop-test-"));
    const subdir = path.join(dir, "a", "b");
    fs.mkdirSync(subdir, { recursive: true });
    const file = path.join(dir, ".antislop.yml");
    fs.writeFileSync(file, "preset: cti\nbannedVocab:\n  - foobar\n", "utf8");

    const found = findConfig(subdir);
    expect(found).toBe(file);

    const parsed = loadConfigFile(found!);
    expect(parsed.preset).toBe("cti");
    expect(parsed.bannedVocab).toContain("foobar");

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns null when nothing is found", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "antislop-test-"));
    expect(findConfig(dir)).toBe(null);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
