import type { LegendDisplay } from "../components/legendDisplay";
import type { LayerProps } from "./types";

/**
 * Layers that draw one thing between them and are addressed as one.
 *
 * A thing worth naming on a map is not always a single layer: an outline and the names written over
 * it are two, drawn together, shown and hidden together, and meaningless apart. A group holds them
 * so that neither can be left behind, and so a product has one thing to put in front of a user
 * rather than a pair it has to keep in step itself.
 */
export type LayerGroup = {
  /** Names the group whatever the language, for a product to find it by and for tests to name it. */
  id: string;
  /** What the group is called, already translated. */
  name: string;
  /** In draw order, bottom to top. */
  layers: LayerProps[];
  legend?: LegendDisplay;
};

/** Whether the group is drawn, which every layer in it agrees on. */
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
