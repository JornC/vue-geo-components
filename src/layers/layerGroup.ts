import type { LegendDisplay } from "../components/legendDisplay";
import type { LayerProps } from "./types";

/**
 * Layers that draw one thing between them and are addressed as one.
 *
 * An outline and the names written over it are two layers, shown and hidden together and
 * meaningless apart, so neither can be left behind.
 */
export type LayerGroup = {
  /** Identifies the group whatever the language, which its translated name cannot. */
  key: string;
  /** What the group is called, already translated. */
  name: string;
  /** In draw order, bottom to top. */
  layers: LayerProps[];
  legend?: LegendDisplay;
};

/** Every layer in the group agrees on this. */
export function isLayerGroupVisible(group: LayerGroup): boolean {
  return group.layers[0]?.visibility ?? false;
}

export function layerGroupOpacity(group: LayerGroup): number {
  return group.layers[0]?.opacity ?? 1;
}

/**
 * Both the descriptor and the OpenLayers layer are set, because they are read at different moments:
 * setting only the layer is undone the next time the descriptor is read, and setting only the
 * descriptor does not show until something redraws from it.
 */
export function setLayerGroupVisible(group: LayerGroup, visible: boolean): void {
  for (const layer of group.layers) {
    layer.visibility = visible;
    layer.layerRef?.setVisible(visible);
  }
}

export function setLayerGroupOpacity(group: LayerGroup, opacity: number): void {
  for (const layer of group.layers) {
    layer.opacity = opacity;
    layer.layerRef?.setOpacity(opacity);
  }
}
