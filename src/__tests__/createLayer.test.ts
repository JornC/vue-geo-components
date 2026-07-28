import ImageLayer from "ol/layer/Image.js";
import TileLayer from "ol/layer/Tile.js";
import VectorLayer from "ol/layer/Vector.js";
import VectorTileLayer from "ol/layer/VectorTile.js";
import { get as getProjection } from "ol/proj.js";
import type { Projection } from "ol/proj.js";
import ImageWMS from "ol/source/ImageWMS.js";
import VectorSource from "ol/source/Vector.js";
import WMTS from "ol/source/WMTS.js";
import WMTSTileGrid from "ol/tilegrid/WMTS.js";
import { beforeAll, describe, expect, it } from "vitest";

import { createLayer } from "@/layers/createLayer";
import {
  LayerType,
  type EmptyVectorLayerProps,
  type LayerProps,
  type RESTLayerProps,
  type VectorTileLayerProps,
  type WFSLayerProps,
  type WMSLayerProps,
  type WMTSLayerProps,
} from "@/layers/types";
import { RD, registerRdProjection } from "@/projections/rd";

let projection: Projection;

beforeAll(() => {
  registerRdProjection();
  projection = getProjection(RD)!;
});

/** The fields every descriptor carries, so each test only spells out what it is about. */
const base = { name: "Test layer", visibility: true, opacity: 0.5, zIndex: 3 };

describe("createLayer", () => {
  it("rejects a type it has no builder for", () => {
    const layerProps = { ...base, type: "PLAIN_WRONG" } as unknown as LayerProps;

    expect(() => createLayer(layerProps, projection)).toThrow("Unsupported layer type: PLAIN_WRONG");
  });

  it("stores the created layer on the descriptor", () => {
    const layerProps: EmptyVectorLayerProps = { ...base, type: LayerType.EMPTY_VECTOR_LAYER };

    const layer = createLayer(layerProps, projection);

    expect(layerProps.layerRef).toBe(layer);
  });

  // Every builder re-types the shared five, so a drop in one of them would
  // otherwise go unnoticed behind the type it is specific to.
  describe.each([
    ["empty vector", { type: LayerType.EMPTY_VECTOR_LAYER }],
    [
      "WMTS",
      {
        type: LayerType.WMTS,
        url: "https://example.invalid/wmts",
        layer: "grijs",
        style: "default",
        format: "image/png8",
        matrixSet: RD,
        wrapX: true,
      },
    ],
    [
      "WMS",
      {
        type: LayerType.WMS,
        url: "https://example.invalid/wms",
        layers: "fame:areas",
        version: "1.3.0",
        format: "image/png",
        transparent: true,
        viewparams: (): string => "",
      },
    ],
    [
      "WFS",
      {
        type: LayerType.WFS,
        url: "https://example.invalid/wfs",
        layer: "fame:receptors",
        version: "2.0.0",
        format: "application/json",
        viewparams: (): string => "",
      },
    ],
    ["REST", { type: LayerType.REST, url: "https://example.invalid/areas", bubbleSelectEvents: false, urlRewriter: (url: URL) => url }],
    [
      "vector tile",
      {
        type: LayerType.VECTOR_TILE,
        url: "https://example.invalid/tiles/{z}/{x}/{y}.pbf",
        tileGrid: new WMTSTileGrid({ origin: [0, 0], resolutions: [1], matrixIds: ["0"] }),
        matrixLimits: [],
      },
    ],
  ])("shared layer properties (%s)", (_name, specific) => {
    it("reach the OpenLayers layer", () => {
      const layerProps = { ...base, ...specific, visibility: false, minZoom: 2, maxZoom: 9 } as LayerProps;

      const layer = createLayer(layerProps, projection);

      expect(layer.getVisible()).toBe(false);
      expect(layer.getOpacity()).toBe(0.5);
      expect(layer.getZIndex()).toBe(3);
      expect(layer.getMinZoom()).toBe(2);
      expect(layer.getMaxZoom()).toBe(9);
    });
  });

  it("builds an empty vector layer with an empty source", () => {
    const layerProps: EmptyVectorLayerProps = { ...base, type: LayerType.EMPTY_VECTOR_LAYER };

    const layer = createLayer(layerProps, projection);

    expect(layer).toBeInstanceOf(VectorLayer);
    expect((layer as VectorLayer).getSource()?.getFeatures()).toEqual([]);
  });

  it("builds a WMTS tile grid from the projection extent", () => {
    const layerProps: WMTSLayerProps = {
      ...base,
      type: LayerType.WMTS,
      url: "https://example.invalid/wmts",
      layer: "grijs",
      style: "default",
      format: "image/png8",
      matrixSet: RD,
      wrapX: true,
    };

    const layer = createLayer(layerProps, projection);

    expect(layer).toBeInstanceOf(TileLayer);
    const source = (layer as TileLayer<WMTS>).getSource()!;
    const tileGrid = source.getTileGrid() as WMTSTileGrid;
    // RD spans 880803.84m; the top zoom level is that width over one 256px tile.
    expect(tileGrid.getResolutions()).toHaveLength(14);
    expect(tileGrid.getResolutions()[0]).toBeCloseTo(880803.84 / 256, 6);
    expect(tileGrid.getMatrixIds()).toEqual(Array.from({ length: 14 }, (_, z) => z.toString()));
    expect(tileGrid.getOrigin(0)).toEqual([-285401.92, 903401.92]);
  });

  it("puts the WMS request parameters on the source", () => {
    const layerProps: WMSLayerProps = {
      ...base,
      type: LayerType.WMS,
      url: "https://example.invalid/wms",
      layers: "fame:areas",
      version: "1.3.0",
      format: "image/png",
      transparent: true,
      viewparams: () => "year:2024",
    };

    const layer = createLayer(layerProps, projection);

    expect(layer).toBeInstanceOf(ImageLayer);
    const params = (layer as ImageLayer<ImageWMS>).getSource()!.getParams();
    expect(params.LAYERS).toBe("fame:areas");
    expect(params.VERSION).toBe("1.3.0");
    expect(params.TRANSPARENT).toBe(true);
    expect(params.VIEWPARAMS).toBe("year:2024");
  });

  it("builds the WFS GetFeature query from the descriptor", () => {
    const layerProps: WFSLayerProps = {
      ...base,
      type: LayerType.WFS,
      url: "/geoserver/wfs",
      layer: "fame:receptors",
      version: "2.0.0",
      format: "application/json",
      viewparams: () => "dataset:m26",
    };

    const layer = createLayer(layerProps, projection);

    const url = new URL((layer as VectorLayer).getSource()!.getUrl() as string);
    expect(url.searchParams.get("service")).toBe("WFS");
    expect(url.searchParams.get("request")).toBe("GetFeature");
    expect(url.searchParams.get("version")).toBe("2.0.0");
    // The feature type travels in `layer`, not in a field named after the parameter.
    expect(url.searchParams.get("typeName")).toBe("fame:receptors");
    expect(url.searchParams.get("outputFormat")).toBe("application/json");
    expect(url.searchParams.get("viewparams")).toBe("dataset:m26");
  });

  it("lets a REST layer rewrite its own url, and hands it the projection", () => {
    let seenProjection: Projection | undefined;
    const layerProps: RESTLayerProps = {
      ...base,
      type: LayerType.REST,
      url: "https://example.invalid/areas",
      bubbleSelectEvents: false,
      urlRewriter: (url, proj) => {
        seenProjection = proj;
        url.searchParams.set("srs", proj.getCode());
        return url;
      },
    };

    const layer = createLayer(layerProps, projection);

    expect(seenProjection).toBe(projection);
    expect((layer as VectorLayer<VectorSource>).getSource()!.getUrl()).toBe("https://example.invalid/areas?srs=EPSG%3A28992");
  });

  it("requests only vector tiles inside the layer's matrix limits", () => {
    // Distinct limits per zoom, so this pins the lookup to the tile's own z.
    const layerProps = {
      ...base,
      type: LayerType.VECTOR_TILE,
      url: "https://example.invalid/tiles/{z}/{x}/{y}.pbf",
      tileGrid: new WMTSTileGrid({ origin: [0, 0], resolutions: [1], matrixIds: ["0"] }),
      matrixLimits: [
        { MinTileRow: 0, MaxTileRow: 0, MinTileCol: 0, MaxTileCol: 0 },
        { MinTileRow: 10, MaxTileRow: 12, MinTileCol: 10, MaxTileCol: 12 },
        { MinTileRow: 2, MaxTileRow: 4, MinTileCol: 2, MaxTileCol: 4 },
      ],
    } as VectorTileLayerProps;

    const layer = createLayer(layerProps, projection);

    expect(layer).toBeInstanceOf(VectorTileLayer);
    const tileUrlFunction = (layer as VectorTileLayer).getSource()!.getTileUrlFunction();

    expect(tileUrlFunction([2, 3, 3], 1, projection)).toBe("https://example.invalid/tiles/2/3/3.pbf");
    // Inside level 2's window but outside its own level's, and the other way round.
    expect(tileUrlFunction([1, 3, 3], 1, projection)).toBeUndefined();
    expect(tileUrlFunction([1, 11, 11], 1, projection)).toBe("https://example.invalid/tiles/1/11/11.pbf");
    // Out of range on each axis separately.
    expect(tileUrlFunction([2, 9, 3], 1, projection)).toBeUndefined();
    expect(tileUrlFunction([2, 3, 9], 1, projection)).toBeUndefined();
  });

  it("substitutes view params into a vector tile url when the layer has them", () => {
    const limits = { MinTileRow: 0, MaxTileRow: 9, MinTileCol: 0, MaxTileCol: 9 };
    const layerProps = {
      ...base,
      type: LayerType.VECTOR_TILE,
      url: "https://example.invalid/tiles/{z}/{x}/{y}.pbf?v={ViewParams}",
      tileGrid: new WMTSTileGrid({ origin: [0, 0], resolutions: [1], matrixIds: ["0"] }),
      matrixLimits: [limits, limits],
      viewParams: () => "year:2024",
    } as VectorTileLayerProps;

    const layer = createLayer(layerProps, projection);

    const tileUrlFunction = (layer as VectorTileLayer).getSource()!.getTileUrlFunction();
    expect(tileUrlFunction([1, 1, 1], 1, projection)).toBe("https://example.invalid/tiles/1/1/1.pbf?v=year:2024");
  });
});
