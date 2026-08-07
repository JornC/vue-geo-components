import { describe, expect, it } from "vitest";

import { toLegendDisplay, type LegendTranslator } from "../components/legendDisplay";
import { LegendIconType, LegendType, type ExtendedLegendProps } from "../layers/types";

// Resolves every key to itself, so assertions can name the key that was built.
const echo: LegendTranslator = { t: (key) => key, te: () => true };

// Translates only the keys listed, to tell a missing title or explainer apart.
const known = (keys: string[]): LegendTranslator => ({ t: (key) => `text:${key}`, te: (key) => keys.includes(key) });

function legend(overrides: Partial<ExtendedLegendProps> = {}): ExtendedLegendProps {
  return {
    type: LegendType.COLOR_RANGES,
    title: "unused",
    iconType: LegendIconType.CIRCLE,
    i18nPrefix: "map.legend.directive",
    legendStyles: [
      { key: "HR", fillColor: "#F4E798", strokeColor: "#808080" },
      { key: "VR", fillColor: "#BBDDEA", strokeColor: "#808080" },
    ],
    ...overrides,
  };
}

describe("toLegendDisplay", () => {
  it("Returns nothing when there is no legend to resolve", () => {
    expect(toLegendDisplay(undefined, echo), "A layer without a legend renders none").toBeUndefined();
  });

  it("Builds one item per style, keyed and coloured from it", () => {
    const display = toLegendDisplay(legend(), echo);

    expect(
      display?.items.map((item) => item.key),
      "Item keys come from the style keys",
    ).toEqual(["HR", "VR"]);
    expect(
      display?.items.map((item) => item.color),
      "Swatches take the style fill colour",
    ).toEqual(["#F4E798", "#BBDDEA"]);
  });

  it("Resolves item labels under the legend's prefix", () => {
    const display = toLegendDisplay(legend(), echo);

    expect(
      display?.items.map((item) => item.label),
      "Each label is prefix plus style key",
    ).toEqual(["map.legend.directive.HR", "map.legend.directive.VR"]);
  });

  it("Puts the variant between the prefix and the key", () => {
    const display = toLegendDisplay(legend(), echo, "MOLAR");

    expect(display?.title, "The title carries the variant").toBe("map.legend.directive.MOLAR.title");
    expect(display?.items[0]?.label, "Item labels carry the variant too").toBe("map.legend.directive.MOLAR.HR");
  });

  it("Leaves the title off when it has no translation", () => {
    const display = toLegendDisplay(legend(), known([]));

    expect(display?.title, "An untranslated title is omitted rather than shown as its key").toBeUndefined();
  });

  it("Resolves the explainer only when one is asked for and translated", () => {
    const withExplainer = legend({ i18nExplainer: "map.legend.directive.explainer" });

    expect(toLegendDisplay(withExplainer, known(["map.legend.directive.explainer"]))?.explainer, "A translated explainer is resolved").toBe(
      "text:map.legend.directive.explainer",
    );
    expect(toLegendDisplay(withExplainer, known([]))?.explainer, "An untranslated explainer is omitted").toBeUndefined();
    expect(toLegendDisplay(legend(), echo)?.explainer, "No explainer key means no explainer").toBeUndefined();
  });

  it("Carries the icon type through unchanged", () => {
    const display = toLegendDisplay(legend({ iconType: LegendIconType.HEXAGON }), echo);

    expect(display?.iconType, "The icon type decides how items are drawn").toBe(LegendIconType.HEXAGON);
  });
});
