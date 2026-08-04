/**
 * Unit tests for the local-development tool (scripts/geo-dev.mjs).
 *
 * The tool is plain Node with no build step, so it is imported directly. What is
 * covered here is the reasoning that decides whether a stage is safe to use; the
 * end-to-end behaviour is covered by the link-mode job in CI.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// @ts-expect-error - plain JS tooling, deliberately not part of the typed build
import { isCheckout, missingRuntimeDeps, packedPaths, parseArgs, stageProblems } from "../../scripts/geo-dev.mjs";

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "geo-dev-test-"));
}

function write(file: string, contents = "{}") {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

describe("parseArgs", () => {
  it("Takes the first bare word as the command", () => {
    expect(parseArgs(["link", "--consumer", "/app"]), "a leading command is the command").toEqual({
      command: "link",
      consumer: "/app",
    });
  });

  it("Leaves the command unset when only flags are given", () => {
    // The consumer scripts append --consumer after forwarding their own
    // arguments, so a bare pane invocation arrives as flags only.
    expect(parseArgs(["--consumer", "/app"]).command, "no bare word means no command").toBeUndefined();
  });

  it("Finds the command after flags too", () => {
    expect(parseArgs(["--consumer", "/app", "status"]).command, "order must not matter").toBe("status");
  });

  it("Accepts --flag=value as well as --flag value", () => {
    expect(parseArgs(["link", "--checkout=/lib"]).checkout, "inline values are accepted").toBe("/lib");
  });
});

describe("packedPaths", () => {
  const files = [{ path: "package.json" }, { path: "dist/index.js" }];

  it("Reads the array shape npm 10 and 11 return", () => {
    expect(packedPaths([{ files }]), "an array result is the older npm shape").toEqual(["package.json", "dist/index.js"]);
  });

  it("Reads the object shape npm 12 returns", () => {
    expect(packedPaths({ "@aerius/vue-geo-components": { files } }), "an object keyed by name is npm 12").toEqual(["package.json", "dist/index.js"]);
  });

  it("Reports nothing when the result carries no files", () => {
    expect(packedPaths([{ files: [] }]), "an empty pack list is not a usable payload").toBeUndefined();
    expect(packedPaths({}), "neither is an empty result").toBeUndefined();
  });
});

describe("stageProblems", () => {
  it("Accepts a stage that is only real files", async () => {
    const stage = tempDir();
    write(path.join(stage, "package.json"));
    write(path.join(stage, "dist/index.js"), "");

    expect(await stageProblems(stage), "a plain copied tree is what we want").toEqual([]);
  });

  it("Rejects a stage with no package.json", async () => {
    const stage = tempDir();
    write(path.join(stage, "dist/index.js"), "");

    expect((await stageProblems(stage)).join(" "), "without a package.json the package cannot resolve at all").toContain("no package.json");
  });

  it("Rejects a nested node_modules", async () => {
    const stage = tempDir();
    write(path.join(stage, "package.json"));
    write(path.join(stage, "node_modules/ol/package.json"));

    expect((await stageProblems(stage)).join(" "), "a nested node_modules is the duplicate-peer bug this design exists to avoid").toContain(
      "node_modules",
    );
  });

  it("Rejects a symlink inside the stage", async () => {
    const stage = tempDir();
    write(path.join(stage, "package.json"));
    const target = tempDir();
    fs.symlinkSync(target, path.join(stage, "dist"), "dir");

    expect((await stageProblems(stage)).join(" "), "a symlink would resolve back into the checkout and reinstate the bug").toContain("symlink");
  });
});

describe("missingRuntimeDeps", () => {
  it("Names dependencies the app does not have", () => {
    const consumer = tempDir();

    expect(
      missingRuntimeDeps({ dependencies: { "d3-interpolate": "^3.0.1" } }, consumer).map(([name]: [string, string]) => name),
      "runtime dependencies are not staged, so the app must already carry them",
    ).toEqual(["d3-interpolate"]);
  });

  it("Is satisfied once the app has them", () => {
    const consumer = tempDir();
    write(path.join(consumer, "node_modules/d3-interpolate/package.json"));

    expect(missingRuntimeDeps({ dependencies: { "d3-interpolate": "^3.0.1" } }, consumer), "nothing to report").toEqual([]);
  });

  it("Ignores peer dependencies, which resolve from the app by design", () => {
    const consumer = tempDir();

    expect(missingRuntimeDeps({ peerDependencies: { ol: "^10.0.0" } }, consumer), "peers are not our concern").toEqual([]);
  });
});

describe("isCheckout", () => {
  it("Recognises a working checkout", () => {
    const dir = tempDir();
    write(path.join(dir, "package.json"), JSON.stringify({ name: "@aerius/vue-geo-components" }));
    write(path.join(dir, "src/index.ts"), "");

    expect(isCheckout(dir), "a checkout has the sources").toBe(true);
  });

  it("Does not mistake the installed package for a checkout", () => {
    // The published tarball carries these scripts, so the package name alone
    // cannot tell the two apart - only a checkout has src/.
    const dir = tempDir();
    write(path.join(dir, "package.json"), JSON.stringify({ name: "@aerius/vue-geo-components" }));
    write(path.join(dir, "dist/index.js"), "");

    expect(isCheckout(dir), "an installed copy has no sources to stage from").toBe(false);
  });

  it("Says no for anything else", () => {
    expect(isCheckout(tempDir()), "an empty directory is not a checkout").toBe(false);
  });
});
