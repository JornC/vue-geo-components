import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import LayerItemTemplate from "@/components/LayerItemTemplate.vue";
import type { LegendDisplay } from "@/components/legendDisplay";
import { LegendIconType } from "@/layers/types";

const legend: LegendDisplay = {
  iconType: LegendIconType.CIRCLE,
  items: [{ key: "low", color: "#00ff00", label: "Low" }],
};

describe("LayerItemTemplate", () => {
  it("emits toggle when the visibility icon is clicked", async () => {
    const wrapper = mount(LayerItemTemplate, { props: { enabled: true, opacity: 1 } });

    await wrapper.get('[data-id="maplayer-item-show-icon"]').trigger("click");

    expect(wrapper.emitted("toggle")).toHaveLength(1);
  });

  it("emits opacity as a number when the slider moves", async () => {
    const wrapper = mount(LayerItemTemplate, { props: { enabled: true, opacity: 1 } });

    const slider = wrapper.get('[data-id="maplayer-item-opacity-slider"]');
    await slider.setValue("0.4");

    expect(wrapper.emitted("opacity")).toEqual([[0.4]]);
  });

  it("renders the legend only when one is given", () => {
    const without = mount(LayerItemTemplate, { props: { enabled: true, opacity: 1 } });
    expect(without.find(".legend-list").exists()).toBe(false);

    const withLegend = mount(LayerItemTemplate, { props: { enabled: true, opacity: 1, legend } });
    expect(withLegend.get('[data-id="maplayer-item-legend-item-label-low"]').text()).toBe("Low");
  });

  it("renders the header slot next to the toggle", () => {
    const wrapper = mount(LayerItemTemplate, {
      props: { enabled: false, opacity: 1 },
      slots: { header: "<h4>Total deposition</h4>" },
    });

    expect(wrapper.get("h4").text()).toBe("Total deposition");
  });
});
