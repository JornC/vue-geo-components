import { RD } from "../projections/rd";
import { LayerType, type LayerBaseProps, type WFSLayerProps, type WMTSLayerProps } from "./types";

/**
 * Descriptors for the public Dutch map services from PDOK, which every AERIUS
 * product draws its base map from.
 *
 * These only build descriptors - nothing here talks to the network. Styling of
 * the vector services stays with the caller, because what a boundary should
 * look like is a product decision, not a PDOK one.
 */

const BRT_BACKGROUND_URL = "https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0";
const AERIAL_URL = "https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0";
const AREA_DIVISIONS_URL = "https://service.pdok.nl/cbs/gebiedsindelingen";

/** Layer group name that makes base layers mutually exclusive. */
export const BASE_LAYER_GROUP = "base";

/**
 * The cartographic variants PDOK publishes of the BRT achtergrondkaart.
 *
 * The values are PDOK's own layer names, so they are not translated.
 */
export enum PdokBackgroundVariant {
  STANDARD = "standaard",
  GREY = "grijs",
  PASTEL = "pastel",
  WATER = "water",
}

type BackgroundOptions = {
  /** Shown to the user; the caller resolves its own translation. */
  name: string;
  variant: PdokBackgroundVariant;
  visibility?: boolean;
  /** Defaults to RD, the only projection AERIUS products use these in. */
  epsgCode?: string;
};

/** One variant of the PDOK BRT achtergrondkaart, as a base layer. */
export function createPdokBackgroundLayer({ name, variant, visibility = false, epsgCode = RD }: BackgroundOptions): WMTSLayerProps {
  return {
    name,
    url: BRT_BACKGROUND_URL,
    type: LayerType.WMTS,
    layer: variant,
    matrixSet: epsgCode,
    format: "image/png8",
    style: "default",
    wrapX: true,
    visibility,
    opacity: 1,
    group: BASE_LAYER_GROUP,
  };
}

type AerialOptions = {
  name: string;
  visibility?: boolean;
  epsgCode?: string;
};

/** PDOK's most recent aerial photography, as a base layer. */
export function createPdokAerialLayer({ name, visibility = false, epsgCode = RD }: AerialOptions): WMTSLayerProps {
  return {
    name,
    url: AERIAL_URL,
    type: LayerType.WMTS,
    layer: "Actueel_ortho25",
    matrixSet: epsgCode,
    // Unlike the background map, the aerial service publishes no 8-bit variant.
    format: "image/png",
    style: "default",
    wrapX: true,
    visibility,
    opacity: 1,
    group: BASE_LAYER_GROUP,
  };
}

type ProvinceBoundaryOptions = {
  name: string;
  styleFunction: NonNullable<LayerBaseProps["styleFunction"]>;
  visibility?: boolean;
  /**
   * Edition of the CBS gebiedsindelingen service. PDOK publishes one service per
   * year and keeps the older ones; there is no `latest` alias, so the edition has
   * to be named. Required rather than defaulted, because a default here would go
   * stale in the library and every product would silently inherit it.
   */
  year: number;
};

/** Dutch province boundaries, from the CBS gebiedsindelingen service. */
export function createPdokProvinceBoundaryLayer({ name, styleFunction, visibility = true, year }: ProvinceBoundaryOptions): WFSLayerProps {
  return {
    name,
    url: `${AREA_DIVISIONS_URL}/${year}/wfs/v1_0`,
    type: LayerType.WFS,
    version: "2.0.0",
    layer: "provincie_gegeneraliseerd",
    visibility,
    format: "application/json; subtype=geojson",
    opacity: 1,
    viewparams: () => "",
    styleFunction,
  };
}
