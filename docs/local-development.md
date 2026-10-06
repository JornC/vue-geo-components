# Local development against a consuming app

Use the library's `geo-lib.sh` script to switch between a local checkout and the
published development build. Local mode creates a direct symlink in the app's
`node_modules` and rebuilds the library when you save.

## In GRIP

GRIP provides a wrapper at `dev/geo-lib.sh`. Run it from the GRIP repository root:

```bash
./dev/geo-lib.sh status
./dev/geo-lib.sh update
```

`update` installs the newest published `@aerius/vue-geo-components@dev` snapshot.
It uses `--no-save`, so the app's dependency files stay unchanged. A fresh `npm ci`
will restore the version in the lockfile.

To work on the library itself, install its dependencies with `npm install` in the
library checkout. Then, from the GRIP repository root:

```bash
export VUE_GEO_COMPONENTS_DIR=/path/to/vue-geo-components
./dev/geo-lib.sh link
./dev/geo-lib.sh
```

If the library is checked out beside GRIP, the script detects it automatically and
the environment variable is optional. Set it explicitly to select another checkout
or worktree. Linking uses that checkout's current branch; it does not fetch or pull.

`link` creates the symlink. Running the script without a command opens the Geo lib
pane and builds the linked checkout with `vite build --watch`. Keep it running so
changes reach the app. GRIP's `dev/serve.sh` starts this pane as part of the stack;
if it is already running, use **S** there to switch modes and start the watcher.

| Command                   | Effect                                                             |
| ------------------------- | ------------------------------------------------------------------ |
| `./dev/geo-lib.sh status` | Show whether the app uses a published package or a local checkout. |
| `./dev/geo-lib.sh link`   | Link the local checkout.                                           |
| `./dev/geo-lib.sh unlink` | Replace the link with the newest published `@dev` build.           |
| `./dev/geo-lib.sh update` | Update the published installation to the newest `@dev` build.      |
| `./dev/geo-lib.sh`        | Open the pane; watch and rebuild in local mode.                    |

The pane offers **S** to switch modes, **U** to update in published mode, and **Q**
to quit. Restart the app's frontend after switching builds if Vite still serves the
old dependency.

## Other consuming apps

The shared scripts ship with the package. From an app's frontend directory, where
its `package.json` and `node_modules` live, call:

```bash
./node_modules/@aerius/vue-geo-components/scripts/geo-lib.sh "$PWD" status
```

Replace `status` with `link`, `unlink`, or `update`, or omit it to open the pane.
`geo-lib.sh` delegates the mode changes to `geo-lib-link.sh`. An app wrapper only
needs to supply its frontend directory, as GRIP's wrapper does.

The scripts require Bash and Unix tools. On Windows, use WSL for this workflow;
the npm command below can also run in a native Windows terminal.

## Share a dependency update with teammates and CI

A local symlink and the script's `--no-save` installs do not change what CI installs.
After library changes merge to `main` and its snapshot publishes, run this in the
consuming app's frontend directory:

```bash
npm install --save-exact @aerius/vue-geo-components@dev
```

If the app is currently linked, use `geo-lib.sh unlink` first. Commit the updated
`package.json` and `package-lock.json`. This saves the resolved snapshot version;
repeat the command to adopt a newer one. A plain reinstall of a release dependency
such as `^0.1.0` will not select development snapshots. See
[versioning.md](./versioning.md) for releases and snapshot publishing.
