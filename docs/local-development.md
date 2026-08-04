# Local development against a consuming app

Change library code and see it in the running app straight away, with nothing published.

```bash
npm run dev:link -- --consumer ../grip/source/frontend    # once
npm run dev:watch -- --consumer ../grip/source/frontend   # rebuild and restage on save
```

In GRIP and Archive you need neither command: their dev stacks already run a `Geo lib` pane
that does this, and `S` in that pane switches the app between your checkout and the
published package.

## What it does, and why it is not a symlink

The app has to resolve this library exactly the way it would resolve an install from Nexus.
Node and TypeScript resolve a module to its real path and then walk `node_modules` upward
from there, so where the package physically sits decides which copy of `ol`, `vue`, `pinia`
and `proj4` it finds.

Symlinking a checkout into the app breaks that. The checkout root has its own
`node_modules` holding all four - it needs them to build standalone - so the app ends up
with two copies of each. OpenLayers classes carry private fields, which makes two copies
nominally distinct, and every OpenLayers type stops being assignable to itself. In GRIP
that was 66 type errors in files nobody had touched.

So we do not link the checkout. `scripts/geo-dev.mjs` stages the exact `npm pack` payload -
the published artifact, nothing else - into `<app>/.geo-lib/` and points
`node_modules/@aerius/vue-geo-components` at that. The stage holds no `node_modules` and no
symlinks, both checked on every run, so there is no second copy to find.

That is one placement rule instead of a list of packages to deduplicate, and it holds for
`vue-tsc`, Volar, Cypress, vitest, `vite dev` and `vite build` at once - including for any
peer added later.

## Commands

All of them take `--consumer <the app's frontend directory>`.

| Command  | What it does                                                     |
| -------- | ---------------------------------------------------------------- |
| `pane`   | The dev-stack pane: shows the mode, rebuilds, switches on a key. |
| `link`   | Stage this checkout and point the app at it.                     |
| `watch`  | Link, then rebuild and restage on every save.                    |
| `unlink` | Back to the published package the app's lockfile pins.           |
| `update` | Move the app to the newest published snapshot.                   |
| `status` | What the app resolves right now, and whether it is stale.        |

Only `link` and `watch` need a checkout. It is found beside your repositories; name it with
`--checkout <dir>` or `VUE_GEO_COMPONENTS_DIR` if yours is elsewhere or under another name.

## Things worth knowing

**Nothing shows up in the app's git.** The stage writes its own `.gitignore`, and switching
modes never touches the app's `package.json` or lockfile.

**`npm install` in the app replaces the link.** npm owns `node_modules`, so a plain install
puts the published package back. The pane notices and restages; otherwise run `link` again.

**Runtime dependencies are not staged.** A real install resolves them from the app, so the
app needs them already. `link` names any that are missing and how to add them, rather than
staging a package whose imports cannot resolve.

**Peers come from the app.** If your checkout builds against a different version than the
app runs, `link` says so. It does not refuse: both satisfy the declared range, and a Nexus
install would allow the same.

**The stage is a snapshot, not a live view.** Without `watch` running, your edits do not
reach the app. `status` compares the two and says when they differ.

## Sharing changes

This is local only. To give changes to teammates or CI, push to `main`: that publishes a new
`dev` snapshot automatically. See [versioning.md](./versioning.md).
