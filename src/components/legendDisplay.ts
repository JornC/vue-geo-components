import type { LegendIconType } from "../layers/types";

/** One row of a layer legend: a coloured icon and the text beside it. */
export interface LegendItem {
  /** Used as the render key and in the row's data-id hooks. */
  key: string;
  color: string;
  label: string;
}

/**
 * Everything {@link LayerItemsLegend} needs to render, with all text already
 * resolved. The i18n keys to resolve it from live on the layer model's
 * ExtendedLegendProps.
 */
export interface LegendDisplay {
  iconType: LegendIconType;
  items: LegendItem[];
  title?: string;
  explainer?: string;
}
