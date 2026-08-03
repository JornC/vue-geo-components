#!/usr/bin/env node
/**
 * Local development against a consuming app, without publishing.
 *
 * The consuming app must resolve this library exactly the way it would resolve
 * an install from Nexus. That means the installed package's real location may
 * not have a `node_modules` of its own above it: Node and TypeScript both
 * resolve a module to its real path and then walk `node_modules` upward from
 * there. Symlinking the checkout in directly breaks that rule - the checkout
 * root has `node_modules/{ol,vue,pinia,proj4}`, because those are devDependencies
 * this library needs to build standalone - so the app ends up with two copies of
 * every peer. OpenLayers classes carry private fields, so the two copies are not
 * interchangeable and every OpenLayers type stops being assignable to itself.
 *
 * So we do not link the checkout. We stage the exact `npm pack` payload - the
 * published artifact, nothing more - into the app's own tree and link that. The
 * stage holds no `node_modules` and no symlinks, so there is no second copy to
 * find. Peers resolve from the app, as they would after a real install.
 *
 * Node builtins only, on purpose: this has to run from a consumer that has not
 * installed anything of ours.
 */

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Bumped when the contract with the consumer shell scripts changes. */
export const geoDevProtocol = 1;

const PACKAGE_NAME = "@aerius/vue-geo-components";
const PUBLISHED_TAG = "dev";
const STAGE_ROOT = ".geo-lib";
const LOCK_FILE = ".geo-dev.lock";
const LINKS_FILE = ".geo-links.json";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultCheckout = path.resolve(scriptDir, "..");

const log = (msg) => console.warn(`[geo-dev] ${msg}`);

function fail(msg) {
  console.error(`[geo-dev] ${msg}`);
  process.exit(1);
}

// The command is the first bare word, wherever it falls: consumers append
// --consumer after forwarding their own arguments, so a bare invocation is
// "--consumer <dir>" with no command at all.
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split("=");
    if (flag === "--consumer" || flag === "--checkout") {
      args[flag.slice(2)] = inline ?? argv[++i];
    } else if (!args.command && !flag.startsWith("-")) {
      args.command = flag;
    }
  }
  return args;
}

function resolveConsumer(raw) {
  if (!raw) {
    fail("--consumer <frontend-dir> is required (the directory holding the app's package.json)");
  }
  const dir = path.resolve(raw);
  if (!fs.existsSync(path.join(dir, "package.json"))) {
    fail(`no package.json in ${dir} - point --consumer at the app's frontend directory`);
  }
  return dir;
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

function stagePaths(consumer) {
  const root = path.join(consumer, STAGE_ROOT);
  return {
    root,
    stage: path.join(root, ...PACKAGE_NAME.split("/")),
    state: path.join(root, "state.json"),
    entry: path.join(consumer, "node_modules", ...PACKAGE_NAME.split("/")),
  };
}

/**
 * The files npm would publish. `npm pack --json` returns an array on npm 10 and
 * 11 and an object keyed by package name on npm 12, and both are inside the
 * range this repo supports, so normalise rather than assume.
 */
function packList(checkout) {
  const out = runCapture("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], checkout);
  let parsed;
  try {
    parsed = JSON.parse(out);
  } catch {
    fail(`could not parse 'npm pack --json' output:\n${out.slice(0, 400)}`);
  }
  const entry = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0];
  if (!entry?.files?.length) {
    fail("'npm pack --json' reported no files");
  }
  const files = entry.files.map((f) => f.path);
  if (!files.includes("package.json")) {
    fail("the pack list has no package.json - refusing to stage an unresolvable package");
  }
  if (!files.some((f) => f.startsWith("dist/"))) {
    fail("the pack list has no dist/ - build the library first: npm run build-only");
  }
  return files;
}

function runCapture(cmd, args, cwd) {
  const res = spawnSync(cmd, args, { cwd, encoding: "utf8", shell: process.platform === "win32" });
  if (res.status !== 0) {
    fail(`${cmd} ${args.join(" ")} failed in ${cwd}:\n${res.stderr || res.stdout}`);
  }
  return res.stdout;
}

/**
 * Copy the pack list into `dest`. The list is the set of allowed paths, not a
 * guarantee they exist right now: linking while a watch rebuild is mid-flight is
 * normal, and a file that vanished under us is not an error worth aborting for.
 */
async function stageFiles(checkout, dest, files) {
  let copied = 0;
  for (const rel of files) {
    const from = path.join(checkout, rel);
    const to = path.join(dest, rel);
    try {
      await fsp.mkdir(path.dirname(to), { recursive: true });
      await fsp.copyFile(from, to);
      copied++;
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }
  return copied;
}

/**
 * The whole correctness argument in three checks. A symlink inside the stage
 * would resolve back into the checkout and reinstate the bug exactly.
 */
async function assertStageInvariants(stage) {
  if (!fs.existsSync(path.join(stage, "package.json"))) {
    fail("staged tree has no package.json - the package would not resolve");
  }
  const walk = async (dir) => {
    for (const item of await fsp.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isSymbolicLink()) {
        fail(`staged tree contains a symlink (${full}) - it would resolve back into the checkout`);
      }
      if (item.isDirectory()) {
        if (item.name === "node_modules") {
          fail(`staged tree contains node_modules (${full}) - that is the duplication this avoids`);
        }
        await walk(full);
      }
    }
  };
  await walk(stage);
}

/**
 * Runtime dependencies are not staged - a real install would resolve them from
 * the app's own tree, so the app must already have them. Report precisely what
 * is missing instead of staging a package whose imports cannot resolve.
 */
function auditRuntimeDeps(checkoutPkg, consumer) {
  const deps = Object.entries(checkoutPkg.dependencies ?? {});
  const missing = deps.filter(([name]) => !fs.existsSync(path.join(consumer, "node_modules", name, "package.json")));
  if (missing.length) {
    const spec = missing.map(([name, range]) => `${name}@${range}`).join(" ");
    fail(
      `this app is missing runtime dependencies the library needs: ${spec}\n` +
        `  A published install would have brought them in. Add them with:\n` +
        `    (cd ${consumer} && npm install ${spec} --no-save)`,
    );
  }
}

/**
 * Peers resolve from the app, so the app's version is what actually runs. Say so
 * when it differs from what the checkout builds against, but do not fail: both
 * versions satisfy the declared range and a Nexus install would allow the same,
 * so refusing here would invent a divergence that production does not have.
 */
function auditPeers(checkoutPkg, checkout, consumer) {
  for (const name of Object.keys(checkoutPkg.peerDependencies ?? {})) {
    const mine = path.join(checkout, "node_modules", name, "package.json");
    const theirs = path.join(consumer, "node_modules", name, "package.json");
    if (!fs.existsSync(mine) || !fs.existsSync(theirs)) {
      continue;
    }
    const a = readJson(mine).version;
    const b = readJson(theirs).version;
    if (a !== b) {
      log(`peer ${name}: checkout builds against ${a}, this app runs ${b}`);
    }
  }
}

/**
 * A working checkout, as opposed to an installed copy of ourselves. The
 * published package carries these scripts too, so "has our package.json" is not
 * enough to tell the two apart - only a checkout has the sources.
 */
function isCheckout(dir) {
  try {
    return readJson(path.join(dir, "package.json")).name === PACKAGE_NAME && fs.existsSync(path.join(dir, "src"));
  } catch {
    return false;
  }
}

/**
 * Find a checkout to stage from, searching outward from the app. Only `link`
 * and `watch` need one; everything else works from the installed package, so a
 * developer who never cloned the library is never asked for a path.
 */
function findCheckout(consumer, override) {
  if (override) {
    return path.resolve(override);
  }
  if (process.env.VUE_GEO_COMPONENTS_DIR) {
    return path.resolve(process.env.VUE_GEO_COMPONENTS_DIR);
  }
  if (isCheckout(defaultCheckout)) {
    return defaultCheckout;
  }
  // Walk up to the app's repository, then look beside it. Depth varies: a plain
  // clone and a bare repository with one worktree per branch sit differently.
  let dir = consumer;
  const roots = [];
  for (let i = 0; i < 8 && dir !== path.dirname(dir); i++) {
    if (fs.existsSync(path.join(dir, ".git"))) {
      roots.push(dir, path.dirname(dir));
    }
    dir = path.dirname(dir);
  }
  for (const root of roots) {
    const candidate = path.join(path.dirname(root), "vue-geo-components");
    if (isCheckout(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function requireCheckout(consumer, override) {
  const found = findCheckout(consumer, override);
  if (!found) {
    fail(
      "no vue-geo-components checkout found beside this repository.\n" + "  Clone it next to your other repositories, or set VUE_GEO_COMPONENTS_DIR.",
    );
  }
  if (!isCheckout(found)) {
    fail(`${found} is not a vue-geo-components checkout`);
  }
  return found;
}

/** The version the app's lockfile pins, which is what `npm ci` would install. */
function pinnedVersion(consumer) {
  try {
    const lock = readJson(path.join(consumer, "package-lock.json"));
    return lock.packages?.[`node_modules/${PACKAGE_NAME}`]?.version;
  } catch {
    return undefined;
  }
}

function npmInstall(consumer, spec) {
  // --no-save keeps the tag in package.json and leaves the lockfile alone; only
  // node_modules changes, so linking never shows up in git status.
  const res = spawnSync("npm", ["install", spec, "--no-save"], {
    cwd: consumer,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (res.status !== 0) {
    fail(`npm install ${spec} failed`);
  }
}

/**
 * Back to the published package. Deliberately needs no checkout: the way out of
 * local mode must not depend on the checkout you are leaving.
 */
function unlink(consumer) {
  const { root, entry } = stagePaths(consumer);
  fs.rmSync(entry, { recursive: true, force: true });
  fs.rmSync(root, { recursive: true, force: true });

  const pinned = pinnedVersion(consumer);
  if (pinned) {
    log(`installing the pinned published version (${pinned})`);
    npmInstall(consumer, `${PACKAGE_NAME}@${pinned}`);
  } else {
    log(`the lockfile pins no ${PACKAGE_NAME}; installing the ${PUBLISHED_TAG} tag`);
    npmInstall(consumer, `${PACKAGE_NAME}@${PUBLISHED_TAG}`);
  }
  log("published: installed");
}

/**
 * Move to the newest published snapshot. Resolve the tag to a version first:
 * installing the tag itself reconciles against the lockfile and reports success
 * without moving.
 */
function update(consumer) {
  const out = spawnSync("npm", ["view", `${PACKAGE_NAME}@${PUBLISHED_TAG}`, "version"], {
    cwd: consumer,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const latest = out.stdout?.trim();
  if (out.status !== 0 || !latest) {
    fail(`could not resolve ${PACKAGE_NAME}@${PUBLISHED_TAG} from Nexus`);
  }
  const { root, entry } = stagePaths(consumer);
  fs.rmSync(entry, { recursive: true, force: true });
  fs.rmSync(root, { recursive: true, force: true });
  log(`installing the newest published snapshot (${latest})`);
  npmInstall(consumer, `${PACKAGE_NAME}@${latest}`);
  log("this changed node_modules only; install it without --no-save and commit the lockfile to move everyone");
}

function installedVersion(consumer) {
  try {
    return readJson(path.join(consumer, "node_modules", ...PACKAGE_NAME.split("/"), "package.json")).version;
  } catch {
    return undefined;
  }
}

function currentMode(consumer) {
  const { state, entry } = stagePaths(consumer);
  if (fs.existsSync(state)) {
    return "local";
  }
  return fs.existsSync(entry) ? "published" : "none";
}

function linkEntry(stage, entry) {
  fs.mkdirSync(path.dirname(entry), { recursive: true });
  fs.rmSync(entry, { recursive: true, force: true });
  // Junctions need neither administrator rights nor Developer Mode on Windows.
  fs.symlinkSync(stage, entry, process.platform === "win32" ? "junction" : "dir");
}

function rememberConsumer(checkout, consumer) {
  const file = path.join(checkout, LINKS_FILE);
  const current = fs.existsSync(file) ? readJson(file) : [];
  const next = [...new Set([...current, consumer])].filter((dir) => fs.existsSync(dir));
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

async function link(checkout, consumer, { quiet = false } = {}) {
  const pkg = readJson(path.join(checkout, "package.json"));
  auditRuntimeDeps(pkg, consumer);

  const files = packList(checkout);
  const { root, stage, state, entry } = stagePaths(consumer);

  const staging = path.join(root, `.staging-${process.pid}`, ...PACKAGE_NAME.split("/"));
  fs.rmSync(path.join(root, `.staging-${process.pid}`), { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  const copied = await stageFiles(checkout, staging, files);
  await assertStageInvariants(staging);

  fs.mkdirSync(path.dirname(stage), { recursive: true });
  fs.rmSync(stage, { recursive: true, force: true });
  fs.renameSync(staging, stage);
  fs.rmSync(path.join(root, `.staging-${process.pid}`), { recursive: true, force: true });

  // The stage ignores itself, so no consumer needs a .gitignore entry for it.
  fs.writeFileSync(path.join(root, ".gitignore"), "*\n");
  linkEntry(stage, entry);

  fs.writeFileSync(
    state,
    `${JSON.stringify({ mode: "linked", checkout, version: pkg.version, protocol: geoDevProtocol, staged: new Date().toISOString() }, null, 2)}\n`,
  );
  rememberConsumer(checkout, consumer);

  if (!quiet) {
    auditPeers(pkg, checkout, consumer);
    log(`staged ${copied} files of ${pkg.name}@${pkg.version} into ${path.relative(consumer, stage)}`);
    log(`${path.relative(consumer, entry)} -> the stage. Peers resolve from this app.`);
  }
  return { stage, copied };
}

function hashDist(dir) {
  const hash = createHash("sha1");
  const walk = (d) => {
    if (!fs.existsSync(d)) {
      return;
    }
    for (const item of fs.readdirSync(d, { withFileTypes: true }).sort((x, y) => x.name.localeCompare(y.name))) {
      const full = path.join(d, item.name);
      if (item.isDirectory()) {
        walk(full);
      } else if (item.isFile()) {
        hash.update(item.name).update(fs.readFileSync(full));
      }
    }
  };
  walk(dir);
  return hash.digest("hex").slice(0, 12);
}

function lockIsLive(checkout) {
  const file = path.join(checkout, LOCK_FILE);
  if (!fs.existsSync(file)) {
    return false;
  }
  const pid = Number(fs.readFileSync(file, "utf8").trim());
  try {
    process.kill(pid, 0);
    return pid !== process.pid;
  } catch {
    return false;
  }
}

function takeLock(checkout) {
  if (lockIsLive(checkout)) {
    return false;
  }
  fs.writeFileSync(path.join(checkout, LOCK_FILE), `${process.pid}\n`);
  const release = () => fs.rmSync(path.join(checkout, LOCK_FILE), { force: true });
  process.on("exit", release);
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
  return true;
}

/**
 * Rebuild on change and re-stage after each build.
 *
 * The mirror runs from rollup's `closeBundle`, not from a filesystem watcher:
 * `vite build --watch` empties `dist` before every rebuild, and a copy racing
 * that emptying dies in a way no `try`/`catch` can reach. Driving vite in-process
 * means we only ever copy a finished build.
 */
async function watch(checkout, consumers) {
  const require = createRequire(path.join(checkout, "package.json"));
  const { build } = await import(require.resolve("vite"));

  const holdsLock = takeLock(checkout);
  if (!holdsLock) {
    log("another geo-dev watch already builds this checkout; mirroring its output only");
  }

  let staging = false;
  const mirror = async () => {
    if (staging) {
      return;
    }
    staging = true;
    try {
      for (const consumer of consumers) {
        const { copied } = await link(checkout, consumer, { quiet: true });
        log(`mirrored ${copied} files -> ${consumer}`);
      }
    } catch (err) {
      console.error(`[geo-dev] mirror failed: ${err.message}`);
    } finally {
      staging = false;
    }
  };

  await mirror();

  if (!holdsLock) {
    // Someone else drives the build; re-stage on their output instead.
    fs.watch(path.join(checkout, "dist"), { persistent: true }, debounce(mirror, 300));
    return;
  }

  const typeCheck = spawn("npx", ["vue-tsc", "--build", "--watch"], {
    cwd: checkout,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  for (const stream of [typeCheck.stdout, typeCheck.stderr]) {
    stream.on("data", (d) =>
      String(d)
        .split("\n")
        .filter(Boolean)
        .forEach((line) => console.warn(`[types] ${line}`)),
    );
  }
  typeCheck.on("exit", (code) => log(`type-check watcher exited (${code}); types are no longer being checked`));

  log(`watching ${checkout}`);
  await build({
    root: checkout,
    configFile: path.join(checkout, "vite.config.ts"),
    build: { watch: {} },
    plugins: [{ name: "aerius-geo-stage-mirror", closeBundle: mirror }],
  });
}

function debounce(fn, ms) {
  let timer;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

function status(consumer) {
  const { stage, state, entry } = stagePaths(consumer);
  if (!fs.existsSync(state)) {
    console.log("published: not linked to a local checkout");
    return;
  }
  const saved = readJson(state);
  const entryIsLink = fs.existsSync(entry) && fs.lstatSync(entry).isSymbolicLink();
  console.log(`local: ${PACKAGE_NAME}@${saved.version} staged from ${saved.checkout}`);
  if (!entryIsLink) {
    console.log("  WARNING: node_modules entry is not the stage - npm has replaced it. Re-run link.");
  }
  const staged = hashDist(path.join(stage, "dist"));
  const source = hashDist(path.join(saved.checkout, "dist"));
  if (staged !== source) {
    console.log(`  WARNING: stage (${staged}) differs from the checkout's dist (${source}). Re-run link or start watch.`);
  }
  console.log(`  watcher: ${lockIsLive(saved.checkout) ? "running" : "NOT running - edits will not reach this app"}`);
}

/**
 * The dev-stack pane. Shows how the app currently resolves the library, drives
 * the rebuild loop in local mode, and switches modes on a keypress.
 *
 * It lives here rather than in each consumer because it was identical in both,
 * and it runs from the installed package, so it works before anyone has cloned
 * this repository.
 */
async function pane(consumer, checkoutOverride) {
  const { entry } = stagePaths(consumer);
  let child;

  const stopChild = () => {
    if (child) {
      child.kill();
      child = undefined;
    }
  };
  process.on("exit", stopChild);

  const render = () => {
    const mode = currentMode(consumer);
    console.log("==================================================");
    if (mode === "local") {
      const saved = readJson(stagePaths(consumer).state);
      console.log(`Geo lib: LOCAL   ${saved.checkout}`);
      console.log(`Staged as ${saved.version}. Rebuilding and re-staging on change.`);
      // npm owns node_modules, so a plain npm install silently replaces the link.
      if (!fs.existsSync(entry) || !fs.lstatSync(entry).isSymbolicLink()) {
        console.log("!! node_modules no longer points at the stage - something reinstalled it.");
        console.log("!! Re-staging now; your edits were not reaching the app.");
      }
      console.log("  [S] switch to published   [Q] quit");
    } else if (mode === "published") {
      console.log(`Geo lib: PUBLISHED   ${installedVersion(consumer) ?? "unknown"}`);
      console.log("  [U] move to the newest snapshot   [S] stage a local checkout   [Q] quit");
    } else {
      console.log("Geo lib: NOT INSTALLED");
      console.log("  [S] stage a local checkout   [Q] quit");
    }
    console.log("==================================================");
    return mode;
  };

  const startWatch = (checkout) => {
    stopChild();
    child = spawn(process.execPath, [fileURLToPath(import.meta.url), "watch", "--consumer", consumer, "--checkout", checkout], {
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (child) {
        console.log(`!! the rebuild loop exited (${code}). Edits are no longer reaching the app.`);
      }
    });
  };

  const refresh = () => {
    const mode = render();
    if (mode === "local") {
      startWatch(readJson(stagePaths(consumer).state).checkout);
    }
    return mode;
  };

  let mode = refresh();

  // Detached or piped: there are no keys to read, so just stay up.
  if (!process.stdin.isTTY) {
    await new Promise(() => {});
    return;
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  const act = async (fn) => {
    stopChild();
    console.log("");
    try {
      await fn();
    } catch (err) {
      console.error(`[geo-dev] ${err.message}`);
    }
    mode = refresh();
  };

  process.stdin.on("data", (key) => {
    if (key === "\u0003" || key === "q" || key === "Q") {
      stopChild();
      process.exit(0);
    }
    if (key === "s" || key === "S") {
      void act(async () => {
        if (mode === "local") {
          unlink(consumer);
        } else {
          await link(requireCheckout(consumer, checkoutOverride), consumer);
        }
      });
    }
    if ((key === "u" || key === "U") && mode === "published") {
      void act(async () => update(consumer));
    }
  });

  await new Promise(() => {});
}

/**
 * Only act when run as a command; importing this file must have no effect, so
 * the tests can reach its helpers.
 *
 * Compare real paths, not the strings: consumers invoke this through
 * node_modules, which is a symlink into the stage, and Node reports the resolved
 * path in `import.meta.url` while leaving `process.argv[1]` as written.
 */
function invokedDirectly() {
  if (!process.argv[1]) {
    return false;
  }
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  await main(process.argv.slice(2));
}

async function main(argv) {
  const args = parseArgs(argv);
  const command = args.command ?? "pane";
  const consumer = resolveConsumer(args.consumer);

  switch (command) {
    case "link":
      await link(requireCheckout(consumer, args.checkout), consumer);
      break;
    case "watch": {
      const checkout = requireCheckout(consumer, args.checkout);
      await link(checkout, consumer);
      await watch(checkout, rememberConsumer(checkout, consumer));
      break;
    }
    case "unlink":
      unlink(consumer);
      break;
    case "update":
      update(consumer);
      break;
    case "toggle":
      if (currentMode(consumer) === "local") {
        unlink(consumer);
      } else {
        await link(requireCheckout(consumer, args.checkout), consumer);
      }
      break;
    case "status":
      status(consumer);
      break;
    case "pane":
      await pane(consumer, args.checkout);
      break;
    default:
      console.log(`Usage: node geo-dev.mjs <command> --consumer <frontend-dir> [--checkout <dir>]

  pane     dev-stack pane: show the mode, rebuild on change, switch on a keypress (default)
  link     stage a checkout's pack payload into the app and point node_modules at it
  watch    link, then rebuild and re-stage on every change
  unlink   go back to the published package the lockfile pins
  update   move to the newest published snapshot
  toggle   unlink if local, link if not
  status   report what the app resolves, and whether it is stale

Only link and watch need a checkout; it is found beside your repositories,
or named with --checkout / VUE_GEO_COMPONENTS_DIR.`);
      process.exit(1);
  }
}
