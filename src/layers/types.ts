import type { FeatureLike } from "ol/Feature";
import type Layer from "ol/layer/Layer";
import type { Projection } from "ol/proj";
import type WMTSTileGrid from "ol/tilegrid/WMTS";

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

export interface LayerProps {
  type: LayerType;

  name: string;
  visibility: boolean;
  opacity: number;

  /* Only 1 layer of a given group can be visible at the same time. This is useful for example for base layers */
  group?: string;

  /* Reference to the physical layer object */
  layerRef?: Layer;

  legend?: LegendProps;

  zIndex?: number;

  onHover?: (feature: FeatureLike) => void;
  onUnHover?: () => void;
  onClick?: (feature: FeatureLike) => void;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- preserves GRIP's loose style-function contract; tightened in a later decoupling step.
  styleFunction?: (feature: FeatureLike, resolution?: number) => any;

  minZoom?: number;
  maxZoom?: number;
}

export interface WMSLayerProps extends LayerProps {
  url: string;
  layers: string;
  version: string;
  format: string;
  transparent: boolean;
  viewparams: () => string;
}

export interface WMTSLayerProps extends LayerProps {
  url: string;
  layer: string;
  style: string;
  format: string;
  matrixSet: string;
  wrapX: boolean;
}

export interface WFSLayerProps extends LayerProps {
  url: string;
  typeName: string;
  version: string;
  format: string;
  layer: string;
  viewparams: () => string;
}

export interface RESTLayerProps extends LayerProps {
  url: string;
  urlRewriter: (url: URL, projection: Projection) => URL;
  bubbleSelectEvents: boolean;
}

export interface VectorTileLayerProps extends LayerProps {
  url: string;
  viewParams?: () => string;
  declutter?: boolean;
  tileGrid: WMTSTileGrid;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- WMTS capabilities matrix limits are untyped upstream; tightened in a later decoupling step.
  matrixLimits: Array<any>;
}

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
