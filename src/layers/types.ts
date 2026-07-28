import type { FeatureLike } from "ol/Feature.js";
import type Layer from "ol/layer/Layer.js";
import type { Projection } from "ol/proj.js";
import type WMTSTileGrid from "ol/tilegrid/WMTS.js";

export type GeoInformation = {
  epsgCode: string;
  extent: number[];
  center: number[];
  initialZoom: number;
  minZoom: number;
  maxZoom: number;
  projection: string;
};

export enum LayerType {
  WMTS = "WMTS",
  WMS = "WMS",
  WFS = "WFS",
  REST = "REST",
  VECTOR_TILE = "VECTOR_TILE",
  EMPTY_VECTOR_LAYER = "EMPTY_VECTOR_LAYER",
}

/**
 * What every layer descriptor carries, whatever its type. Consumers hold
 * {@link LayerProps}, the union of the concrete shapes below; this is the part
 * they share.
 */
export interface LayerBaseProps {
  name: string;
  visibility: boolean;
  /* 0 to 1, matching OpenLayers */
  opacity: number;

  /* Only 1 layer of a given group can be visible at the same time. This is useful for example for base layers */
  group?: string;

  /* Reference to the physical layer object */
  layerRef?: Layer;

  legend?: LegendProps;

  zIndex?: number;

  onHover?: (feature: FeatureLike) => void;
  hoverableFunction?: () => boolean;
  onUnHover?: () => void;
  onClick?: (feature: FeatureLike) => void;

  styleFunction?: (feature: FeatureLike, resolution?: number) => any;

  minZoom?: number;
  maxZoom?: number;
}

export interface WMSLayerProps extends LayerBaseProps {
  type: LayerType.WMS;
  url: string;
  layers: string;
  version: string;
  format: string;
  transparent: boolean;
  viewparams: () => string;
}

export interface WMTSLayerProps extends LayerBaseProps {
  type: LayerType.WMTS;
  url: string;
  layer: string;
  style: string;
  format: string;
  matrixSet: string;
  wrapX: boolean;
}

export interface WFSLayerProps extends LayerBaseProps {
  type: LayerType.WFS;
  url: string;
  version: string;
  format: string;
  /* Feature type to request; sent as the typeName parameter */
  layer: string;
  viewparams: () => string;
}

export interface RESTLayerProps extends LayerBaseProps {
  type: LayerType.REST;
  url: string;
  urlRewriter: (url: URL, projection: Projection) => URL;
  bubbleSelectEvents: boolean;
}

export interface VectorTileLayerProps extends LayerBaseProps {
  type: LayerType.VECTOR_TILE;
  url: string;
  viewParams?: () => string;
  declutter?: boolean;
  tileGrid: WMTSTileGrid;
  matrixLimits: Array<any>;
}

export interface EmptyVectorLayerProps extends LayerBaseProps {
  type: LayerType.EMPTY_VECTOR_LAYER;
}

/**
 * A layer descriptor. Narrowing on `type` gives you the matching shape, so a
 * descriptor that claims to be WMTS cannot be built without a WMTS url.
 */
export type LayerProps = EmptyVectorLayerProps | WMSLayerProps | WMTSLayerProps | WFSLayerProps | RESTLayerProps | VectorTileLayerProps;

export type LayerStyleType = {
  key: string;
  max?: number; // test if value < than max
  maxAnd?: number; // test if value <= than maxAnd
  fillColor: string;
  strokeColor: string;
};

export enum LegendType {
  TEXT = "TEXT",
  COLOR_RANGES = "COLOR_RANGES",
}

export interface LegendProps {
  type: LegendType;
  title: string;
}

export interface TextLegendProps extends LegendProps {
  text: string;
}

export interface ColorRange {
  color: string;
  label?: string;
  labelValues?: number[];
}

export interface ColorRangesLegendProps extends LegendProps {
  colorRanges: ColorRange[];
  text?: string;
  textAfter?: string;
  iconType: ColorRangeIconType;
}

export enum ColorRangeIconType {
  CIRCLE,
}

export enum LegendIconType {
  CIRCLE = "CIRCLE",
  HEXAGON = "HEXAGON",
}

export interface ExtendedLegendProps extends LegendProps {
  iconType: LegendIconType;
  i18nPrefix: string;
  i18nExplainer?: string;
  legendStyles: [LayerStyleType, ...LayerStyleType[]];
}

export interface Datum {
  year: number;
}
