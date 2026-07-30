/**
 * Reading the bits of a WMTS GetCapabilities document that a vector-tile layer
 * descriptor needs.
 *
 * OpenLayers' `WMTSCapabilities` format parses the XML; what it hands back is
 * untyped, so this narrows the part we actually read.
 */

export type WmtsCapabilitiesJson = {
  Contents: {
    TileMatrixSet: Array<Record<string, unknown>>;
    Layer: Array<{
      Identifier: string;
      TileMatrixSetLink: Array<{ TileMatrixSet: string; TileMatrixSetLimits: Array<Record<string, unknown>> }>;
    }>;
  };
};

/**
 * The tile-matrix limits a layer publishes for one projection.
 *
 * Without these a vector-tile layer requests tiles outside the area the server
 * actually holds, so every out-of-range tile is a wasted 404.
 *
 * @throws if the capabilities document has no such layer, or the layer is not
 *   published in that projection - both mean the descriptor would be built with
 *   limits that do not match the tiles being requested.
 */
export function getMatrixLimitsForLayer(capabilities: WmtsCapabilitiesJson, layerId: string, epsgCode: string): Array<Record<string, unknown>> {
  const layer = capabilities.Contents.Layer.find((candidate) => candidate.Identifier === layerId);
  if (!layer) {
    throw new Error(`WMTS capabilities contain no layer "${layerId}"`);
  }

  const link = layer.TileMatrixSetLink.find((candidate) => candidate.TileMatrixSet === epsgCode);
  if (!link) {
    throw new Error(`WMTS layer "${layerId}" is not published in ${epsgCode}`);
  }

  return link.TileMatrixSetLimits;
}
