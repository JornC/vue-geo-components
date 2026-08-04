# Versioning and releases

`package.json` starts at `0.0.0` and holds the last released version. Day to day it never
changes: snapshots don't touch it, so routine work needs no version bump and no PR. The one
exception is cutting a real release, where you bump it yourself with `npm version` and land
that commit on `main` (see [Real releases](#real-releases-latest-tag)). There is no
automated bump-back and no per-change version PR.

## Snapshots (`dev` tag)

Every push to `main` publishes a snapshot to Nexus under the `dev` tag (see
[`.github/workflows/publish.yml`](../.github/workflows/publish.yml)). This is how apps
track the newest build.

- CI runs first (lint, format, type-check, test, build). Only if it passes does the
  snapshot publish.
- The workflow gives each snapshot a unique version by appending `-dev-<hash>` to the base
  `0.0.0`: `0.0.0-dev-<hash>`, e.g. `0.0.0-dev-1a2b3c4`. Because each version is unique,
  there is never a stale-cache or re-publish problem.
- The `dev` tag always points at the newest snapshot.

Apps opt in by depending on the `dev` tag and moving forward with `npm update` - see
["Use the newest build" in the README](../README.md#use-the-newest-build). An app pins the
exact snapshot it resolved in its own `package-lock.json`, so `npm ci` stays reproducible;
the tag only decides what `npm update` pulls forward.

Old `-development-` snapshots accumulate on every push, so Nexus should prune them on a
retention policy (like Maven `-SNAPSHOT`). Keep them long enough to cover how far back you
rebuild `main`.

## Real releases (`latest` tag)

Releases follow the standard npm/GitHub flow (see
[`.github/workflows/on-release-published.yml`](../.github/workflows/on-release-published.yml)
and the
[GitHub tutorial](https://docs.github.com/en/actions/tutorials/publish-packages/publish-nodejs-packages)).
`main` is protected, so the version bump lands through a PR and the tag is created when you
cut the Release:

1. Bump the version on a branch - `package.json` and the lockfile only, no local tag (the
   tag has to sit on `main`):

   ```bash
   npm version minor --no-git-tag-version   # patch | minor | major, or an exact number
   git commit -am "0.2.0"
   ```

   `patch` is 0.1.0 -> 0.1.1 (fixes), `minor` is 0.1.0 -> 0.2.0 (features; may break while
   on 0.x), `major` is 0.1.0 -> 1.0.0 (breaking, once stable).

2. Open a PR with that bump and merge it into `main`.

3. On GitHub, draft a Release, create a new tag `v0.2.0` targeting `main`, and publish it.
   GitHub puts the tag on the merged commit (where `package.json` is now `0.2.0`); the notes
   are the changelog.

Publishing the Release runs the workflow: `npm ci`, build, `npm publish`. The version is
whatever `package.json` holds at the tagged commit - no version step in CI, nothing
committed back. The guard fails the run if `package.json` and the tag disagree, so a
mismatched Release can never publish the wrong number. `npm publish` ships to the default
`latest` tag, so apps can pin an exact release (`@aerius/vue-geo-components@0.2.0`).

Snapshots are unaffected: the snapshot job always publishes `0.0.0-dev-<hash>` regardless of
what `package.json` says.

## Infra needed before the first publish

- The npm repository on Nexus (`https://nexus.aerius.nl/repository/npm/`). The registry URL
  is configurable via the `NEXUS_REGISTRY` repo/org **variable**; set it only if the path
  differs from that default.
- A dedicated Nexus CI account (not a personal login) with publish rights, stored as the
  `NEXUS_USERNAME` and `NEXUS_PASSWORD` secrets on the **upstream** repo
  (`aerius/vue-geo-components`). The workflow base64-encodes the pair into a `NEXUS_AUTH`
  environment variable, which the generated `.npmrc` reads.
- Publishing runs only on the upstream repo. Forks run CI but never publish, so no secret
  is needed on a fork.
- A Nexus cleanup policy that prunes old snapshot versions (see above).
