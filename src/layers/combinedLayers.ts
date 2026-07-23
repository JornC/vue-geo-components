import type { LayerProps } from "./types";

/**
 * Class to keep track of multiple layers of which only 1 can be active at a time.
 */
export class CombinedLayers {
  layers: LayerProps[];
  selectedLayer: LayerProps | null;
  layerEnabled: boolean;
  layerOpacity: number;

  /**
   * Constructor
   *
   * @param layerEnabled if the layer is enabled, default is value.
   */
  constructor(layerEnabled: boolean = false) {
    this.layers = [];
    this.selectedLayer = null;
    this.layerEnabled = layerEnabled;
    this.layerOpacity = 100;
  }

  getSelectedLayer(): LayerProps | null {
    return this.selectedLayer;
  }

  getLayers(): LayerProps[] {
    return this.layers;
  }

  setLayers(layers: LayerProps[]) {
    this.layers = layers;
  }

  getLayerOpacity(): number {
    return this.selectedLayer?.layerRef?.getOpacity() ?? 100;
  }

  setLayerOpacity(opacity: number) {
    this.layers.forEach((lp) => lp?.layerRef?.setOpacity(opacity));
    this.setLayerEnabled(opacity !== 0);
  }

  isLayerEnabled(): boolean {
    return this.layerEnabled;
  }

  setLayerEnabled(visible: boolean) {
    this.layerEnabled = visible;
    this.selectedLayer?.layerRef?.setVisible(this.layerEnabled.valueOf());
  }

  switchLayer(layerName: string) {
    this.layers.forEach((layer) => {
      if (layerName === layer.name) {
        this.selectedLayer = layer;
        this.setLayerEnabled(true);
      } else {
        layer.layerRef?.setVisible(false);
      }
    });
  }

  toggleLayer() {
    this.setLayerEnabled(!this.layerEnabled);
  }
}
