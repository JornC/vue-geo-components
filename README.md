# @aerius/vue-geo-components

Shared Vue 3 + OpenLayers geo components for AERIUS frontends. The stack is Vue 3, Vite,
TypeScript, OpenLayers 10, proj4, and Pinia.

The library is built with Vite and ships as ESM. `ol`, `vue`, `proj4`, and `pinia` are
peer dependencies: the library does not bundle them, it uses the app's own copies.

> Status: filling up. The layer model and the layer panel UI have moved over from GRIP.
> The map engine itself still lives there and follows in a later step.

## Use it in an app

**1. Point npm at Nexus for the `@aerius` scope.** Add this line to the app's `.npmrc`:

```
@aerius:registry=https://nexus.aerius.nl/repository/npm/
```

(If reads need a login, run
`npm login --scope=@aerius --registry=https://nexus.aerius.nl/repository/npm/` once.)

**2. Install it**, plus the peer dependencies if the app doesn't already have them:

```bash
npm install @aerius/vue-geo-components
npm install ol vue proj4 pinia
```

**3. Use it:**

```vue
<script setup lang="ts">
import { MapView } from "@aerius/vue-geo-components";
import "@aerius/vue-geo-components/style.css";
import "ol/ol.css";
</script>

<template>
  <MapView :zoom="7" style="height: 480px" />
</template>
```

`MapView` uses the Dutch RD map projection (EPSG:28992) by default. Child components can
get the map with `useMap()`.

## Use the newest build

Say an app uses this library and you want to always work against the latest version.
There are two cases:

**You are editing the library too.** Use yalc: your local library changes show up in the
app the moment you save - live, with nothing to publish. This is the fastest loop. See
[docs/local-development.md](./docs/local-development.md).

**You just want the newest published build** (you're not editing the library). Depend on
the `dev` tag in the app's `package.json`:

```json
"@aerius/vue-geo-components": "dev"
```

Every push to this library's `main` publishes a new `dev` snapshot. Pull the newest one
into the app with:

```bash
npm update @aerius/vue-geo-components
```

Each snapshot has a unique version, so this always works cleanly. The app stays on whatever
is locked in its `package-lock.json` until you run `npm update`, so `npm ci` stays
reproducible. See [docs/versioning.md](./docs/versioning.md).

## Pin a released version

For a stable build (e.g. on an app's release branch), depend on a real release number
instead of the `dev` tag:

```bash
npm install @aerius/vue-geo-components@0.2.0
```

Real releases are published to the `latest` tag from a GitHub Release - see
[docs/versioning.md](./docs/versioning.md).

## Develop this library

Use Node 24 (see [`.nvmrc`](./.nvmrc)).

```bash
npm install
npm run dev          # rebuild on every save
npm run lint
npm run type-check
npm test
npm run build        # type-check + build dist/
```

- **Work on it against a consuming app:** [docs/local-development.md](./docs/local-development.md)
- **Releasing and versioning:** [docs/versioning.md](./docs/versioning.md)

## What it exports

Everything comes from [`src/index.ts`](./src/index.ts):

| Export                                                 | What it is                                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `MapView`                                              | The OpenLayers map as a Vue component. Shares the map with child components.      |
| `useMap` / `provideMap` / `mapInjectionKey`            | Get or share the map instance.                                                    |
| `RD` / `registerRdProjection` / `isRdRegistered`       | Dutch RD map projection (EPSG:28992).                                             |
| `useMapViewStore`                                      | Shared map state (center, zoom).                                                  |
| `LayerType` / `LayerProps` and its per-type variants   | The layer model: what a layer is, before it becomes an OpenLayers layer.          |
| `CombinedLayers`                                       | A set of layers of which only one is visible at a time, such as base layers.      |
| `toStylesMap` / `findStyleKey` / `toLegendStyleValues` | Turn layer style values into OpenLayers styles, or pick the one a value falls in. |
| `LayerItemTemplate`                                    | A layer panel row: visibility toggle, opacity slider and legend.                  |
| `LayerItemsLegend`                                     | The legend on its own, for a panel you build yourself.                            |
| `LegendDisplay` / `LegendItem`                         | What a legend renders. Text is resolved by you, so the library carries no i18n.   |

## License

AGPL-3.0-only. See [LICENSE](./LICENSE).
