import type { ExtendedLegendProps, LegendIconType } from "../layers/types";

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

/** The part of a vue-i18n composer this needs, passed in so the library takes on no i18n dependency. */
export interface LegendTranslator {
  t: (key: string) => string;
  te: (key: string) => boolean;
}

/**
 * `variant` is an extra key segment for legends whose text depends on a
 * setting: with one, keys read `<prefix>.<variant>.title`, without, plain
 * `<prefix>.title`. A title or explainer with no translation is left off.
 *
 * Call it from a template so it re-runs when the locale or the variant changes.
 */
export function toLegendDisplay(legend: ExtendedLegendProps | undefined, { t, te }: LegendTranslator, variant?: string): LegendDisplay | undefined {
  if (!legend) {
    return undefined;
  }

  const key = (last: string) => [legend.i18nPrefix, variant, last].filter(Boolean).join(".");
  const titleKey = key("title");

  return {
    iconType: legend.iconType,
    title: te(titleKey) ? t(titleKey) : undefined,
    explainer: legend.i18nExplainer && te(legend.i18nExplainer) ? t(legend.i18nExplainer) : undefined,
    items: legend.legendStyles.map((style) => ({
      key: style.key,
      color: style.fillColor,
      label: t(key(style.key)),
    })),
  };
}
