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

**2. Install the newest development build**, plus any missing peer dependencies:

```bash
npm install --save-exact @aerius/vue-geo-components@dev
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

For a local update in GRIP, run this from the GRIP repository root:

```bash
./dev/geo-lib.sh update
```

The Geo lib pane in GRIP's development stack also offers **U** to update in published
mode and **S** to switch between a published build and a local checkout. The scripts
use the `dev` tag explicitly. `update` and `unlink` install with `--no-save`, so they
leave the app's `package.json` and lockfile unchanged.

To adopt the newest snapshot for teammates and CI, run this in the app's frontend
directory and commit both dependency files. If currently linked, run
`./dev/geo-lib.sh unlink` from the GRIP root first:

```bash
npm install --save-exact @aerius/vue-geo-components@dev
```

This resolves `dev` to a specific `0.0.0-dev-<sha>` version and saves it. Repeat the
command to adopt a newer snapshot; `npm ci` installs the locked version. A plain
reinstall does not move a release dependency such as `^0.1.0` onto development builds.
`latest` is the release tag; `dev` points to the newest published snapshot from `main`.
See [docs/versioning.md](./docs/versioning.md).

To edit the library alongside an app, use the direct-symlink workflow in
[docs/local-development.md](./docs/local-development.md). It also explains how apps
without GRIP's wrapper can call the shared scripts.

## Pin a released version

For a stable build (e.g. on an app's release branch), depend on a real release number
instead of the `dev` tag:

```bash
npm install @aerius/vue-geo-components@0.1.0
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

- **`MapView`** - The OpenLayers map as a Vue component. Shares the map with child
  components.
- **`useMap` / `provideMap` / `mapInjectionKey`** - Get or share the map instance.
- **`registerProjection` / `isProjectionRegistered`** - Register any projection
  (proj4 def + extent) with OpenLayers, keyed by EPSG code.
- **`RD` / `RD_EXTENT` / `RD_PROJ4_DEFINITION` / `registerRdProjection` / `isRdRegistered`** -
  Dutch RD map projection (EPSG:28992), built on `registerProjection`.
- **`useMapViewStore`** - Shared map state (center, zoom).
- **`LayerType` / `LayerProps` and its per-type variants** - The layer model: what a
  layer is, before it becomes an OpenLayers layer.
- **`CombinedLayers`** - A set of layers of which only one is visible at a time, such as
  base layers.
- **`createLayer`** - Build the OpenLayers layer a descriptor asks for.
- **`toStylesMap` / `findStyleKey` / `toLegendStyleValues`** - Turn layer style values
  into OpenLayers styles, or pick the one a value falls in.
- **`LayerItemTemplate`** - A layer panel row: visibility toggle, opacity slider and
  legend.
- **`LayerItemsLegend`** - The legend on its own, for a panel you build yourself.
- **`LegendDisplay` / `LegendItem`** - What a legend renders.
- **`toLegendDisplay` / `LegendTranslator`** - Resolve a layer's `ExtendedLegendProps`
  i18n keys into a `LegendDisplay`. You hand it your `t` and `te`, so the library takes
  on no i18n dependency of its own.
- **`createHexagonFeature` / `pointFromReceptorId` / `receptorIdFromPoint` /
  `centerFromHexagon` / `isReceptorAtZoomLevel` / `centerPointOnReceptor` /
  `centerPointOnReceptorAtZoom`** - The AERIUS receptor grid: the RD-anchored hexagon
  lattice and its stable ids.
- **`createSelectedReceptorLayer` / `renderSelectedReceptor` / `selectedReceptorStyle` /
  `createReceptorLabelStyle`** - Drawing the receptor a user picked. The hexagon is always
  drawn; the lines out to the map edges can be turned off with the `crosshair` option.
- **`createPdokBackgroundLayer` / `createPdokAerialLayer` /
  `createPdokProvinceBoundaryLayer` / `PdokBackgroundVariant`** - Descriptors for the
  public Dutch map services. Vector styling stays with you.
- **`natureAreasToFeatures` / `natureAreaPointStyle` / `natureAreaExtent` / `NatureArea`** -
  Natura 2000 sites as map points. You fetch and cache them; this shapes them.
- **`getMatrixLimitsForLayer` / `WmtsCapabilitiesJson`** - The tile-matrix limits a
  vector-tile layer needs, from a WMTS GetCapabilities.
- **`createHandleFeatureClicked`** - Pick the feature you meant out of everything under
  the cursor.
- **`createMapFlyTo` / `zoomToExtent`** - Smooth pan-and-zoom along a van Wijk path, and
  fitting an extent with it.
- **`scaleDenominatorToResolution`** - Turn a cartographic scale (1:800000) into an
  OpenLayers resolution.

## Theming

The components that draw chrome read these custom properties. Each has a neutral
default, so they render sensibly unset; set them on any ancestor to match your product.

| Property               | Default   | What it colours                          |
| ---------------------- | --------- | ---------------------------------------- |
| `--geo-surface`        | `#fff`    | Panel row background                     |
| `--geo-surface-raised` | `#f4f4f6` | Panel row background while expanded      |
| `--geo-accent`         | `#333`    | Foldout chevron, and its badge once open |
| `--geo-on-accent`      | `#fff`    | The chevron against that badge           |
| `--geo-spacing`        | `0.5rem`  | Padding and gaps                         |
| `--geo-anim`           | `0.2s`    | Transition duration                      |

`--hexagon-color` and `--outline-color` are not part of this: `LayerItemsLegend` sets
them per item when drawing hexagon swatches.

## License

AGPL-3.0-only. See [LICENSE](./LICENSE).
