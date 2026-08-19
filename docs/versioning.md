# Versioning and releases

This library publishes **two different kinds of version**, and almost every question about
versioning here is really the question "which of the two am I looking at?"

|             | Snapshot                                          | Release                                                                     |
| ----------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| When        | every push to `main`, always                      | only when someone needs one                                                 |
| Looks like  | `0.0.0-dev-1a2b3c4`                               | `0.1.0`                                                                     |
| npm tag     | `dev`                                             | `latest`                                                                    |
| Who does it | CI, automatically                                 | a person, deliberately                                                      |
| Workflow    | [`publish.yml`](../.github/workflows/publish.yml) | [`on-release-published.yml`](../.github/workflows/on-release-published.yml) |

Snapshots happen on their own and you never think about them. A release is the only thing
you actually have to _do_, and it is three steps - bump, merge, tag.

`package.json` holds the **last released version**, and nothing else ever changes it.
Snapshots don't touch it, so day-to-day work needs no version bump and no version PR. There
is no automated bump-back.

## Snapshots (the `dev` tag)

Every push to `main` publishes a snapshot to Nexus under the `dev` tag. This is how apps
track the newest build without waiting for a release.

- CI runs first - lint, format, type-check, test, build. The snapshot publishes only if all
  of it passes.
- The workflow makes each snapshot unique by taking the base `0.0.0` and appending the first
  7 characters of the commit SHA: `0.0.0-dev-<sha7>`, e.g. `0.0.0-dev-1a2b3c4`. That base is
  hardcoded in the workflow - it does **not** come from `package.json`.
- Every snapshot version is unique, so there is never a stale-cache or re-publish problem.
- The `dev` tag always points at the newest snapshot.

Apps opt in by depending on the `dev` tag and moving forward with `npm update` - see
["Use the newest build" in the README](../README.md#use-the-newest-build). An app pins the
exact snapshot it resolved in its own `package-lock.json`, so `npm ci` stays reproducible;
the tag only decides what `npm update` pulls forward.

Old `-dev-` snapshots accumulate on every push, so Nexus should prune them on a retention
policy (like Maven `-SNAPSHOT`). Keep them long enough to cover how far back you rebuild
`main`, and never prune the one the `dev` tag points at.

## Cutting a release (the `latest` tag)

`main` is protected, so the version bump goes in through a PR like any other change, and the
git tag gets created by GitHub when you publish the Release.

Written out for `0.1.0` - substitute your own number:

**Step 1. Bump the version on a branch.**

Any ordinary PR branch will do - your fork, or this repo directly if you have push rights.
Wherever you normally open PRs from. It only has to reach `main` through a PR rather than
landing on it directly, which `main` being protected enforces anyway.

```bash
git fetch upstream
git checkout -b release-0.1.0 upstream/main
npm version 0.1.0 --no-git-tag-version
git commit -am "0.1.0"
git push -u origin release-0.1.0
```

`--no-git-tag-version` matters: it changes `package.json` and `package-lock.json` and
nothing else. Do **not** create a git tag locally - the tag has to end up on `main`, and
GitHub creates it for you in step 3.

**Step 2. Open a PR with that bump and merge it into `main`.**

It is a two-line diff. After it merges, `main`'s `package.json` says `0.1.0`.

**Step 3. Publish a GitHub Release.**

On GitHub: **Releases** -> **Draft a new release**.

- **Choose a tag**: type `v0.1.0` and pick "Create new tag: v0.1.0 on publish"
- **Target**: `main`
- Write the notes - these _are_ the changelog, there is no `CHANGELOG.md`
- **Publish release**

Publishing it runs the workflow: check the version, `npm ci`, build, `npm publish`. The
published version is whatever `package.json` holds at the tagged commit - CI never computes
or commits a version. A guard fails the run if `package.json` and the tag disagree, so a
mistyped tag can't publish the wrong number.

**Step 4. Check it landed.**

```bash
npm view @aerius/vue-geo-components dist-tags
```

You should see `latest: 0.1.0` alongside the `dev` entry. Apps can now pin the exact release
with `npm install @aerius/vue-geo-components@0.1.0`.

### Which number do I pick?

Releases here are pulled by demand from the consuming apps (GRIP, archive-service) rather
than pushed on a roadmap, so you choose the number when you cut the release, looking at a
diff that already exists.

While on `0.x`, npm treats the **minor** as the breaking position - `^0.1.2` means
`>=0.1.2 <0.2.0`. So:

- `0.1.0` -> `0.1.1` (`patch`) - fixes and additions that can't break a consumer
- `0.1.0` -> `0.2.0` (`minor`) - anything that can break a consumer, while on `0.x`
- `0.1.0` -> `1.0.0` (`major`) - once the API is considered stable

## What each workflow does

- [`ci.yml`](../.github/workflows/ci.yml) - on every pull request. Lint, format, type-check,
  test and build, each as its own job so one failure doesn't mask the others. Runs on forks
  too. Publishes nothing.
- [`publish.yml`](../.github/workflows/publish.yml) - on every push to `main`. Runs the same
  checks, then publishes the `0.0.0-dev-<sha7>` snapshot to the `dev` tag. Publishing is
  restricted to the `aerius/vue-geo-components` repo, and serialized so two quick pushes
  can't leave `dev` pointing at the older one.
- [`on-release-published.yml`](../.github/workflows/on-release-published.yml) - when a GitHub
  Release is published. Checks `package.json` against the tag, builds, and publishes to
  `latest`. Same repo restriction.

`package.json` also has a `prepublishOnly` guard that refuses to publish outside CI, so a
stray local `npm publish` can't reach Nexus.

## Rough edges worth knowing

None of these are broken, but they surprise people:

- **Snapshot versions do not sort chronologically.** `0.0.0-dev-<sha7>` sorts by the hex
  characters of the SHA, which have nothing to do with time - of the snapshots published so
  far, 4 of 11 consecutive pairs go _backwards_ by semver precedence. This is harmless
  because the `dev` tag is resolved by _name_, not by version order, so `npm update` always
  gets the newest one. Just don't try to tell which of two snapshots is newer by reading
  their numbers - compare the SHAs against git history instead.
- **After a release, snapshots still say `0.0.0-...`.** The snapshot base is hardcoded, so a
  snapshot built the day after `0.1.0` still reads `0.0.0-dev-<sha7>` and sorts _below_ the
  release even though its code is newer. Again harmless for tag-based resolution, and it
  keeps snapshots out of release ranges like `^0.1.0` (npm excludes prereleases from ranges),
  which is what you want.
- **`npm ci` never tells you your pin is stale.** Under a tag spec like `"dev"`, npm accepts
  whatever version the lockfile already pins - it will not notice that `dev` has moved on.
  Moving forward is always a deliberate `npm update` in the consuming app.
- **`package.json` on `main` is only accurate at release time.** It says "last released
  version", not "what's on main now". The moment the next PR merges it is behind by design.

## Infra behind the publishing

- The npm repository on Nexus. The URL is hardcoded in the repo's own
  [`.npmrc`](../.npmrc) as `@aerius:registry=https://nexus.aerius.nl/repository/npm/`;
  change it there if it ever moves.
- A dedicated Nexus CI account (not a personal login) with publish rights, stored on the
  **upstream** repo (`aerius/vue-geo-components`) as two secrets: `NEXUS_USERNAME` and
  `NEXUS_PASSWORD`. Each publishing workflow combines them into `NEXUS_AUTH` -
  base64 of `user:password` - which `.npmrc` reads. There is no `setup-node` registry
  wiring and no `NODE_AUTH_TOKEN` involved.
- Publishing runs only on the upstream repo. Forks run CI but never publish, so a fork needs
  no secrets.
- A Nexus cleanup policy that prunes old snapshot versions (see above).
