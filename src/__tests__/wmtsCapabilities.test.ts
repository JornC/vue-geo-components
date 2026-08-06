import { describe, expect, it } from "vitest";

import { getMatrixLimitsForLayer, type WmtsCapabilitiesJson } from "@/layers/wmtsCapabilities";

const LIMITS = [{ TileMatrix: "EPSG:28992:0", MinTileRow: 0, MaxTileRow: 1 }];

const capabilities: WmtsCapabilitiesJson = {
  Contents: {
    TileMatrixSet: [],
    Layer: [
      {
        Identifier: "example:areas",
        TileMatrixSetLink: [
          { TileMatrixSet: "EPSG:3857", TileMatrixSetLimits: [] },
          { TileMatrixSet: "EPSG:28992", TileMatrixSetLimits: LIMITS },
        ],
      },
    ],
  },
};

describe("getMatrixLimitsForLayer", () => {
  it("returns the limits published for the requested projection", () => {
    expect(getMatrixLimitsForLayer(capabilities, "example:areas", "EPSG:28992")).toBe(LIMITS);
  });

  it("rejects a layer the document does not describe", () => {
    expect(() => getMatrixLimitsForLayer(capabilities, "example:missing", "EPSG:28992")).toThrow(/no layer "example:missing"/);
  });

  it("rejects a projection the layer is not published in", () => {
    expect(() => getMatrixLimitsForLayer(capabilities, "example:areas", "EPSG:4326")).toThrow(/not published in EPSG:4326/);
  });
});
