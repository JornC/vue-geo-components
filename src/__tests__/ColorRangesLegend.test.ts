import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ColorRangesLegend from "@/components/ColorRangesLegend.vue";
import { ColorRangeIconType, LegendType, type ColorRangesLegendProps } from "@/layers/types";

const colorRangesLegend: ColorRangesLegendProps = {
  type: LegendType.COLOR_RANGES,
  title: "Deposition",
  iconType: ColorRangeIconType.CIRCLE,
  colorRanges: [
    { color: "#00ff00", labelValues: [Number.MIN_VALUE, 10] },
    { color: "#ffff00", labelValues: [10, 20] },
    { color: "#ff0000", labelValues: [20, Number.MAX_VALUE] },
    { color: "#cccccc" },
  ],
};

describe("ColorRangesLegend", () => {
  it("labels a closed range with both bounds and an open one with the bound it has", () => {
    const wrapper = mount(ColorRangesLegend, { props: { colorRangesLegend } });

    const labels = wrapper.findAll(".legend-label").map((label) => label.text());
    expect(labels).toEqual(["< 10", "10 - 20", "> 20", ""]);
  });

  it("colours a swatch per range", () => {
    const wrapper = mount(ColorRangesLegend, { props: { colorRangesLegend } });

    const swatches = wrapper.findAll(".color-range");
    expect(swatches).toHaveLength(4);
    expect(swatches[0]?.attributes("style")).toContain("background-color: rgb(0, 255, 0)");
  });
});
