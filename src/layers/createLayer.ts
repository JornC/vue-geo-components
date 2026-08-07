import { getTopLeft, getWidth } from "ol/extent.js";
import GeoJSON from "ol/format/GeoJSON.js";
import MVT from "ol/format/MVT.js";
import ImageLayer from "ol/layer/Image.js";
import type Layer from "ol/layer/Layer.js";
import TileLayer from "ol/layer/Tile.js";
import VectorLayer from "ol/layer/Vector.js";
import VectorTileLayer from "ol/layer/VectorTile.js";
import { bbox } from "ol/loadingstrategy.js";
import type { Projection } from "ol/proj.js";
import ImageWMS from "ol/source/ImageWMS.js";
import VectorSource from "ol/source/Vector.js";
import VectorTileSource from "ol/source/VectorTile.js";
import WMTS from "ol/source/WMTS.js";
import TileGridWMTS from "ol/tilegrid/WMTS.js";

import {
  LayerType,
  type EmptyVectorLayerProps,
  type LayerBaseProps,
  type LayerProps,
  type RESTLayerProps,
  type VectorTileLayerProps,
  type WFSLayerProps,
  type WMSLayerProps,
  type WMTSLayerProps,
} from "./types";

/** WMTS tile grids are built from square tiles of this many pixels. */
const TILE_SIZE = 256;

/** Zoom levels in a WMTS tile grid. */
const RESOLUTION_COUNT = 14;

/**
 * Build the OpenLayers layer a descriptor asks for.
 *
 * The created layer is also stored on the descriptor's `layerRef`, which is how
 * the rest of the model reaches the live layer to toggle, restyle or reorder it.
 *
 * @throws if the descriptor's type has no builder.
 */
export function createLayer(layerProps: LayerProps, projection: Projection): Layer {
  switch (layerProps.type) {
    case LayerType.WMTS:
      return createWmtsLayer(layerProps, projection);
    case LayerType.WMS:
      return createWmsLayer(layerProps, projection);
    case LayerType.WFS:
      return createWfsLayer(layerProps, projection);
    case LayerType.REST:
      return createRestLayer(layerProps, projection);
    case LayerType.VECTOR_TILE:
      return createVectorTileLayer(layerProps, projection);
    case LayerType.EMPTY_VECTOR_LAYER:
      return createEmptyVectorLayer(layerProps);
    default: {
      // Every member of the union is handled above, so adding a LayerType
      // without a builder fails to compile here rather than at runtime.
      const unhandled: never = layerProps;
      throw new Error(`Unsupported layer type: ${(unhandled as LayerBaseProps & { type: string }).type}`);
    }
  }
}

function createEmptyVectorLayer(layerProps: EmptyVectorLayerProps): Layer {
  const vectorLayer = new VectorLayer({
    source: new VectorSource(),
    opacity: layerProps.opacity,
    visible: layerProps.visibility,
    style: layerProps.styleFunction,
    zIndex: layerProps.zIndex,
    minZoom: layerProps.minZoom,
    maxZoom: layerProps.maxZoom,
  });
  layerProps.layerRef = vectorLayer;
  return vectorLayer;
}

function createVectorTileLayer(layerProps: VectorTileLayerProps, projection: Projection): Layer {
  const vectorTileLayer = new VectorTileLayer({
    source: new VectorTileSource({
      format: new MVT(),
      // Tiles outside the layer's matrix limits have no data; returning no URL
      // for those keeps OpenLayers from requesting them at all.
      tileUrlFunction: (tileCoord) => {
        // OpenLayers types a tile coordinate as a loose number[]; it is always [z, x, y].
        const [z, x, y] = tileCoord as [number, number, number];
        if (
          y >= layerProps.matrixLimits[z].MinTileRow &&
          y <= layerProps.matrixLimits[z].MaxTileRow &&
          x >= layerProps.matrixLimits[z].MinTileCol &&
          x <= layerProps.matrixLimits[z].MaxTileCol
        ) {
          const url = layerProps.url.replace("{y}", y.toString()).replace("{x}", x.toString()).replace("{z}", z.toString());
          if (layerProps.viewParams) {
            return url.replace("{ViewParams}", layerProps.viewParams());
          } else {
            return url;
          }
        }
        return undefined;
      },
      tileGrid: layerProps.tileGrid,
      projection: projection,
    }),
    opacity: layerProps.opacity,
    visible: layerProps.visibility,
    style: layerProps.styleFunction,
    zIndex: layerProps.zIndex,
    minZoom: layerProps.minZoom,
    maxZoom: layerProps.maxZoom,
    declutter: layerProps.declutter,
  });
  layerProps.layerRef = vectorTileLayer;
  return vectorTileLayer;
}

function createRestLayer(layerProps: RESTLayerProps, projection: Projection): Layer {
  const urlWithParams = layerProps.urlRewriter(new URL(layerProps.url), projection);
  const restSource = new VectorSource({
    format: new GeoJSON({
      featureProjection: projection,
    }),
    url: urlWithParams.toString(),
    strategy: bbox,
  });

  const vectorLayer = new VectorLayer({
    source: restSource,
    opacity: layerProps.opacity,
    visible: layerProps.visibility,
    zIndex: layerProps.zIndex,
    minZoom: layerProps.minZoom,
    maxZoom: layerProps.maxZoom,
  });
  layerProps.layerRef = vectorLayer;
  return vectorLayer;
}

function createWfsLayer(layerProps: WFSLayerProps, projection: Projection): Layer {
  const wfsUrl = new URL(layerProps.url, window.location.origin);
  wfsUrl.searchParams.set("service", "WFS");
  wfsUrl.searchParams.set("version", layerProps.version);
  wfsUrl.searchParams.set("request", "GetFeature");
  wfsUrl.searchParams.set("outputFormat", layerProps.format);
  wfsUrl.searchParams.set("typeName", layerProps.layer);
  wfsUrl.searchParams.set("viewparams", layerProps.viewparams());
  const vectorSource = new VectorSource({
    format: new GeoJSON({
      featureProjection: projection,
    }),
    url: wfsUrl.toString(),
    strategy: bbox,
  });
  const vectorLayer = new VectorLayer({
    source: vectorSource,
    opacity: layerProps.opacity,
    visible: layerProps.visibility,
    zIndex: layerProps.zIndex,
    minZoom: layerProps.minZoom,
    maxZoom: layerProps.maxZoom,
    style: layerProps.styleFunction,
    // A style function only runs on a redraw. Without these the layer is
    // scaled through a zoom and restyled once it settles, so anything keyed to
    // the resolution arrives in one jump.
    updateWhileAnimating: true,
    updateWhileInteracting: true,
  });
  layerProps.layerRef = vectorLayer;
  return vectorLayer;
}

function createWmtsLayer(layerProps: WMTSLayerProps, projection: Projection): Layer {
  const projectionExtent = projection.getExtent();

  const size = getWidth(projectionExtent) / TILE_SIZE;
  const resolutions = Array.from({ length: RESOLUTION_COUNT }, (_, z) => size / Math.pow(2, z));
  const matrixIds = Array.from({ length: RESOLUTION_COUNT }, (_, z) => z.toString());
  const wmtsSource = new WMTS({
    url: layerProps.url,
    layer: layerProps.layer,
    matrixSet: layerProps.matrixSet,
    format: layerProps.format,
    projection: projection,
    tileGrid: new TileGridWMTS({
      origin: getTopLeft(projectionExtent),
      resolutions,
      matrixIds,
    }),
    style: layerProps.style,
    wrapX: layerProps.wrapX,
  });

  const wmtsLayer = new TileLayer({
    source: wmtsSource,
    opacity: layerProps.opacity,
    visible: layerProps.visibility,
    zIndex: layerProps.zIndex,
    minZoom: layerProps.minZoom,
    maxZoom: layerProps.maxZoom,
  });

  layerProps.layerRef = wmtsLayer;

  return wmtsLayer;
}

function createWmsLayer(layerProps: WMSLayerProps, projection: Projection): Layer {
  const wmsSource = new ImageWMS({
    url: layerProps.url,
    params: {
      LAYERS: layerProps.layers,
      TILED: true,
      SERVICE: "WMS",
      VERSION: layerProps.version,
      REQUEST: "GetMap",
      FORMAT: layerProps.format,
      TRANSPARENT: layerProps.transparent,
      VIEWPARAMS: layerProps.viewparams(),
    },
    projection: projection,
  });

  const wmsLayer = new ImageLayer({
    source: wmsSource,
    opacity: layerProps.opacity,
    visible: layerProps.visibility,
    zIndex: layerProps.zIndex,
    minZoom: layerProps.minZoom,
    maxZoom: layerProps.maxZoom,
  });

  layerProps.layerRef = wmsLayer;

  return wmsLayer;
}
