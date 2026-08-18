import type Map from "ol/Map.js";
import type { FeatureLike } from "ol/Feature.js";
import { WMTSCapabilities } from "ol/format.js";
import { getHeight, getWidth, type Extent } from "ol/extent.js";
import type VectorLayer from "ol/layer/Vector.js";
import type VectorTileLayer from "ol/layer/VectorTile.js";
import { Fill, Style, Text } from "ol/style.js";
import { createFromCapabilitiesMatrixSet } from "ol/tilegrid/WMTS.js";

import { LABEL_SHAPE, placeLabels } from "../map/labelPlacement";
import { NATURE_AREA_NAME, natureAreasToFeatures, type NatureArea } from "./natureAreas";
import { toStylesMap } from "./layerStyle";
import { getMatrixLimitsForLayer, type WmtsCapabilitiesJson } from "./wmtsCapabilities";
import type { LayerGroup } from "./layerGroup";
import { LegendIconType, LayerType, type EmptyVectorLayerProps, type GeoInformation, type LayerStyleType, type VectorTileLayerProps } from "./types";

/**
 * The Natura 2000 areas the FAME platform publishes, as two layers drawn as one thing: the directive
 * areas as vector tiles, and the site names over them.
 *
 * The names are their own layer because the tiles hold a site as one area per directive, clipped
 * into every tile it crosses, so a name put on those is drawn several times over. FAME's nature API
 * publishes one record per site, which is one name.
 *
 * Where FAME is and which dataset to read are passed in; nothing here reads configuration.
 */

const FAME_LAYER = "monitor:natura2000-area-natura2000-directive-areas";

/** Identifies the group these layers are handed over as. */
export const NATURE_AREAS_GROUP = "nature-areas";

/** Property a tile feature carries its directive in. */
const DIRECTIVE_CODE = "natura2000_directive_area_code";

/** Property tying a tile feature to the site it belongs to, matching the id the API publishes. */
const AREA_CODE = "natura2000_area_code";

/** Not a FAME code: what a feature carrying none falls under. */
export const UNDETERMINED = "undetermined";

/** No halo, and black rather than a colour, as these sites are drawn elsewhere in AERIUS. */
export const NATURE_AREA_LABEL_FONT = 'bold 13px "Noto Sans", Helvetica, Arial, sans-serif';

const LABEL_COLOUR = "#000000";
const LABEL_WRAP_CHARACTERS = 16;

/** Of the font size, averaged over the faces AERIUS draws in. */
const CHARACTER_WIDTH = 0.55;
const LINE_HEIGHT = 1.15;

/** How much larger than its site a name may be and still be worth drawing. */
const LABEL_TO_AREA_RATIO = 1.6;

/** Names declutter among themselves, not against every other decluttered layer. */
const DECLUTTER_GROUP = "nature-area-labels";

type DirectiveArea = LayerStyleType & { key: string };

/** The same colours wherever these areas are drawn, a product's own legend included. */
export const directiveAreaStyleValues: [DirectiveArea, ...DirectiveArea[]] = [
  { key: "HR", fillColor: "#f4e798", strokeColor: "#808080" },
  { key: "VR", fillColor: "#bbddea", strokeColor: "#808080" },
  { key: "VR+HR", fillColor: "#cfe2a1", strokeColor: "#808080" },
  { key: UNDETERMINED, fillColor: "#d6b9d2", strokeColor: "#808080" },
];

const fills = toStylesMap(directiveAreaStyleValues);

/** An unknown code draws nothing rather than being coloured as some other directive. */
export function directiveAreaStyle(feature: FeatureLike): Style | null {
  return fills.get(feature.get(DIRECTIVE_CODE) || UNDETERMINED) ?? null;
}

/** One entry per directive, in the order they are drawn. Labels are the caller's, already resolved. */
export function directiveAreaLegend(labels: Record<string, string>): LayerGroup["legend"] {
  return {
    iconType: LegendIconType.CIRCLE,
    items: directiveAreaStyleValues.map((area) => ({
      key: area.key,
      color: area.fillColor,
      label: labels[area.key] ?? area.key,
    })),
  };
}

/** Breaks on spaces only, so a single long word stays intact rather than being cut mid-name. */
export function wrapLabel(name: string, maxCharacters: number = LABEL_WRAP_CHARACTERS): string {
  const lines: string[] = [];
  let line = "";

  for (const word of name.split(" ")) {
    if (line === "") {
      line = word;
    } else if (line.length + 1 + word.length <= maxCharacters) {
      line = `${line} ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== "") {
    lines.push(line);
  }

  return lines.join("\n");
}

/** Points of the font, so a caller that changes the font is measured in it rather than in 13px. */
function fontSize(font: string): number {
  return Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 13);
}

function fitsArea(label: string, shape: Extent, resolution: number, font: string): boolean {
  const lines = label.split("\n");
  const size = fontSize(font);
  const width = Math.max(...lines.map((line) => line.length)) * size * CHARACTER_WIDTH;

  return (
    width <= (getWidth(shape) / resolution) * LABEL_TO_AREA_RATIO &&
    lines.length * size * LINE_HEIGHT <= (getHeight(shape) / resolution) * LABEL_TO_AREA_RATIO
  );
}

function labelStyle(font: string) {
  return (feature: FeatureLike, resolution: number): Style | undefined => {
    const name = feature.get(NATURE_AREA_NAME);
    const shape = feature.get(LABEL_SHAPE) as Extent | undefined;
    if (!name || !shape) {
      return undefined;
    }

    const label = wrapLabel(String(name));

    return fitsArea(label, shape, resolution, font)
      ? new Style({ text: new Text({ text: label, font, fill: new Fill({ color: LABEL_COLOUR }) }) })
      : undefined;
  };
}

type FameNatureArea = {
  id: string;
  name: string;
  natura2000AreaInfo?: { interiorPoint?: string; extent?: string; authority?: string };
};

/** The sites FAME's nature API publishes, one record each. */
export async function fetchNatureAreas(host: string, dataset: string): Promise<NatureArea[]> {
  const response = await fetch(`${host}/api/nature/${dataset}/natura2000-areas`);
  if (!response.ok) {
    throw new Error(`FAME nature areas returned ${response.status}`);
  }

  const areas = (await response.json()) as FameNatureArea[];

  const usable = areas.filter((area) => area.natura2000AreaInfo?.interiorPoint && area.natura2000AreaInfo.extent);
  for (const area of areas.filter((area) => !usable.includes(area))) {
    // Loud, because a site missing from the map is otherwise indistinguishable from one that is
    // not in the data at all.
    console.warn(`Skipping Natura 2000 site ${area.id}: it has no interior point or extent.`);
  }

  return usable.map((area) => ({
    id: area.id,
    name: area.name,
    authority: area.natura2000AreaInfo?.authority,
    interiorPointWkt: area.natura2000AreaInfo?.interiorPoint as string,
    extentWkt: area.natura2000AreaInfo?.extent as string,
  }));
}

function wmtsUrl(host: string): string {
  return `${host}/geoserver/gwc/service/wmts`;
}

async function readCapabilities(host: string): Promise<WmtsCapabilitiesJson> {
  const response = await fetch(`${wmtsUrl(host)}?service=WMTS&version=1.1.0&request=GetCapabilities`);
  if (!response.ok) {
    throw new Error(`FAME WMTS capabilities returned ${response.status}`);
  }
  return new WMTSCapabilities().read(await response.text()) as WmtsCapabilitiesJson;
}

/**
 * More than one site throws rather than being narrowed, because a product asking for three and
 * being shown one would look like missing data. This runs while a tile URL is built, so OpenLayers
 * is what catches it: expect a failed tile and a console error rather than a clean stack.
 */
export function natureAreaViewParams(dataset: string, areas?: () => string[]): string {
  const selected = areas?.() ?? [];
  if (selected.length > 1) {
    throw new Error(`FAME draws one nature area at a time, not ${selected.length}`);
  }

  const [areaCode] = selected;
  return encodeURIComponent(`dataset:${dataset}${areaCode ? `;natura2000AreaCode:${areaCode}` : ""}`);
}

function matrixSetFor(capabilities: WmtsCapabilitiesJson, epsgCode: string): Record<string, unknown> {
  const matrixSet = capabilities.Contents.TileMatrixSet.find((set) => set.Identifier === epsgCode);
  if (!matrixSet) {
    throw new Error(`FAME does not publish tiles in ${epsgCode}`);
  }
  return matrixSet;
}

export type NatureAreaLayersOptions = {
  /** Base URL of the FAME platform. */
  host: string;
  /**
   * FAME schema to read. GeoServer falls back to `none` without it, which fails.
   *
   * A function for a product that lets the user switch dataset; the tiles follow it on their next
   * request, and {@link NatureAreaLayers.refresh} fetches the names for it again.
   */
  dataset: string | (() => string);
  /** Only what the tile grid needs: the projection to ask FAME for, and the extent it covers. */
  geo: Pick<GeoInformation, "epsgCode" | "extent">;
  /** Shown for the layer, already translated. */
  name: string;
  /** Legend label per directive code, already translated. */
  legendLabels: Record<string, string>;
  font?: string;
  /**
   * Which sites to draw, none meaning all of them. Read for every tile, so a product is free to
   * change what it returns.
   *
   * A list so that this contract survives FAME learning to draw several at once, which would
   * otherwise change every product's call. Its layer takes a single code today - the viewparam
   * validates as one number - so more than one is refused here rather than quietly narrowed.
   */
  areas?: () => string[];
};

export type NatureAreaLayers = LayerGroup & {
  /**
   * Puts the names on their layer and keeps each one on the outline it names. Call once the layers
   * are on the map, since an empty vector layer has no source before that.
   */
  ready: (map: Map) => void;
  /** Reads the names for whatever dataset is current now. Only a product that can switch needs it. */
  refresh: () => Promise<void>;
};

/**
 * Reads what FAME publishes and builds both layers. The tile grid comes from FAME's own capabilities
 * document, so the descriptor cannot be built before that has been fetched.
 */
export async function createNatureAreaLayers({
  host,
  dataset,
  geo,
  name,
  legendLabels,
  font = NATURE_AREA_LABEL_FONT,
  areas,
}: NatureAreaLayersOptions): Promise<NatureAreaLayers> {
  const currentDataset = typeof dataset === "function" ? dataset : () => dataset;
  const [capabilities, initialSites] = await Promise.all([readCapabilities(host), fetchNatureAreas(host, currentDataset())]);
  const matrixLimits = getMatrixLimitsForLayer(capabilities, FAME_LAYER, geo.epsgCode);

  /** The sites the names are drawn from. */
  let sites = initialSites;

  const tiles: VectorTileLayerProps = {
    name,
    type: LayerType.VECTOR_TILE,
    url:
      `${wmtsUrl(host)}?service=WMTS&version=1.1.0&request=GetTile` +
      `&tilecol={x}&tilerow={y}&format=application%2Fvnd.mapbox-vector-tile&viewparams={ViewParams}` +
      `&LAYER=${encodeURI(FAME_LAYER)}&tilematrixset=${geo.epsgCode}&tilematrix=${geo.epsgCode}:{z}`,
    viewParams: () => natureAreaViewParams(currentDataset(), areas),
    tileGrid: createFromCapabilitiesMatrixSet(matrixSetFor(capabilities, geo.epsgCode), geo.extent, matrixLimits),
    matrixLimits,
    visibility: true,
    opacity: 1,
    styleFunction: directiveAreaStyle,
  };

  const names: EmptyVectorLayerProps = {
    name: `${name} names`,
    type: LayerType.EMPTY_VECTOR_LAYER,
    visibility: true,
    opacity: 1,
    styleFunction: labelStyle(font),
  };

  /** Fresh features every time, because placing a name moves the one it sits on. */
  function fill(): void {
    const labels = (names.layerRef as VectorLayer | undefined)?.getSource();
    labels?.clear();
    labels?.addFeatures(natureAreasToFeatures(sites));
  }

  async function refresh(): Promise<void> {
    sites = await fetchNatureAreas(host, currentDataset());
    fill();
  }

  function ready(map: Map): void {
    const shapes = tiles.layerRef as VectorTileLayer | undefined;
    const labels = names.layerRef as VectorLayer | undefined;
    if (!shapes || !labels) {
      throw new Error("The nature area layers have to be on the map before their names can be placed");
    }

    labels.setDeclutter(DECLUTTER_GROUP);
    fill();

    // A name stands on the outline it names, which is only known once that outline is drawn.
    map.on("rendercomplete", () => {
      const resolution = map.getView().getResolution() ?? 0;

      placeLabels({
        labels,
        shapes,
        matchOn: AREA_CODE,
        view: map.getView().calculateExtent(map.getSize()),
        worthPlacing: (shape, label) => fitsArea(wrapLabel(String(label.get(NATURE_AREA_NAME) ?? "")), shape, resolution, font),
      });
    });
  }

  return { key: NATURE_AREAS_GROUP, name, layers: [tiles, names], legend: directiveAreaLegend(legendLabels), ready, refresh };
}
