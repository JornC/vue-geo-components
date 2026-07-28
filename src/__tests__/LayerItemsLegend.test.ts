import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import LayerItemsLegend from "@/components/LayerItemsLegend.vue";
import type { LegendDisplay } from "@/components/legendDisplay";
import { LegendIconType } from "@/layers/types";

const legend = (overrides: Partial<LegendDisplay> = {}): LegendDisplay => ({
  iconType: LegendIconType.CIRCLE,
  items: [
    { key: "low", color: "#00ff00", label: "Low" },
    { key: "high", color: "#ff0000", label: "High" },
  ],
  ...overrides,
});

describe("LayerItemsLegend", () => {
  it("renders one labelled row per item", () => {
    const wrapper = mount(LayerItemsLegend, { props: { legend: legend() } });

    expect(wrapper.findAll(".legend-item")).toHaveLength(2);
    expect(wrapper.get('[data-id="maplayer-item-legend-item-label-low"]').text()).toBe("Low");
    expect(wrapper.get('[data-id="maplayer-item-legend-item-label-high"]').text()).toBe("High");
  });

  it("colours a circle icon per item by default", () => {
    const wrapper = mount(LayerItemsLegend, { props: { legend: legend() } });

    const circle = wrapper.get('[data-id="maplayer-item-legend-item-circle-icon-low"]');
    expect(circle.attributes("style")).toContain("background-color: rgb(0, 255, 0)");
    expect(wrapper.find('[data-id="maplayer-item-legend-item-hexagon-icon-low"]').exists()).toBe(false);
  });

  it("draws hexagons instead of circles when the legend asks for them", () => {
    const wrapper = mount(LayerItemsLegend, { props: { legend: legend({ iconType: LegendIconType.HEXAGON }) } });

    const hexagon = wrapper.get('[data-id="maplayer-item-legend-item-hexagon-icon-low"]');
    expect(hexagon.attributes("style")).toContain("--hexagon-color: #00ff00");
    expect(wrapper.find('[data-id="maplayer-item-legend-item-circle-icon-low"]').exists()).toBe(false);
  });

  it("omits the title and explainer when the consumer resolved neither", () => {
    const wrapper = mount(LayerItemsLegend, { props: { legend: legend() } });

    expect(wrapper.find('[data-id="maplayer-item-legend-title"]').exists()).toBe(false);
    expect(wrapper.find('[data-id="maplayer-item-legend-explainer"]').exists()).toBe(false);
  });

  it("shows the title and explainer when given", () => {
    const wrapper = mount(LayerItemsLegend, { props: { legend: legend({ title: "Deposition", explainer: "mol/ha/yr" }) } });

    expect(wrapper.get('[data-id="maplayer-item-legend-title"]').text()).toBe("Deposition");
    expect(wrapper.get('[data-id="maplayer-item-legend-explainer"]').text()).toBe("mol/ha/yr");
  });
});
