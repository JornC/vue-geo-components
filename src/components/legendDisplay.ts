import type { LegendIconType } from "../layers/types";

/** One row of a layer legend: a coloured icon and the text beside it. */
export interface LegendItem {
  /** Identifies the row; used as the render key and in the row's data-id hooks. */
  key: string;
  /** Fill colour of the row's icon. */
  color: string;
  /** Text beside the icon. */
  label: string;
}

/**
 * Everything {@link LayerItemsLegend} needs to render, with all text already
 * resolved. Consumers translate their own labels, which keeps the library free
 * of any i18n or domain coupling; the layer model's ExtendedLegendProps carries
 * the i18n keys those consumers resolve from.
 */
export interface LegendDisplay {
  iconType: LegendIconType;
  items: LegendItem[];
  title?: string;
  explainer?: string;
}
