import type Layer from "ol/layer/Layer.js";
import { describe, expect, it, vi } from "vitest";

import { LayerType, type LayerProps } from "../layers/types";
import { applyBackgroundFade, backgroundFadeProgress, maxResolution } from "../map/backgroundFade";

// Map units per pixel; larger is further out, and a level out is twice the
// resolution. The fade runs over two levels.
const ZOOMED_IN = maxResolution / 2;
const AT_CUT_OFF = maxResolution;
const HALFWAY_OUT = maxResolution * 2;
const FULLY_OUT = maxResolution * 4;

type StubLayer = LayerProps & { layerRef: Layer };

function stubLayer(opacity: number): StubLayer {
  return {
    type: LayerType.EMPTY_VECTOR_LAYER,
    name: "stub",
    visibility: true,
    opacity,
    layerRef: { setVisible: vi.fn(), setOpacity: vi.fn() } as unknown as Layer,
  };
}

function lastArg<T>(calls: T[][]): T | undefined {
  return calls[calls.length - 1]?.[0];
}

const visibleCalls = (layer: StubLayer) => lastArg(vi.mocked(layer.layerRef.setVisible).mock.calls);
const opacityCalls = (layer: StubLayer) => lastArg(vi.mocked(layer.layerRef.setOpacity).mock.calls);

describe("backgroundFadeProgress", () => {
  it("Reports nothing faded until the cut-off is passed", () => {
    expect(backgroundFadeProgress(AT_CUT_OFF), "The fade starts at the cut-off").toBeCloseTo(0, 5);
    expect(backgroundFadeProgress(ZOOMED_IN), "Zoomed in there is nothing to fade").toBeLessThan(0);
  });

  it("Eases across the zoom levels a user actually stops on", () => {
    // A fade measured in resolution skips every resting zoom and arrives in
    // one step.
    expect(backgroundFadeProgress(HALFWAY_OUT), "One level out is mid-fade").toBeCloseTo(0.5, 5);
    expect(backgroundFadeProgress(FULLY_OUT), "Two levels out the background has gone").toBeUndefined();
  });
});

describe("applyBackgroundFade", () => {
  it("Leaves layers alone while zoomed in", () => {
    const background = stubLayer(1);
    const overlay = stubLayer(0.8);

    applyBackgroundFade(ZOOMED_IN, [background, overlay]);

    expect(visibleCalls(background), "Nothing is hidden while zoomed in").toBe(true);
    expect(opacityCalls(background), "The background keeps full opacity").toBe(1);
    expect(opacityCalls(overlay), "Every layer keeps its own opacity as its ceiling").toBe(0.8);
  });

  it("Fades every layer in step, scaled by its own opacity", () => {
    const background = stubLayer(1);
    const overlay = stubLayer(0.8);

    applyBackgroundFade(HALFWAY_OUT, [background, overlay]);

    expect(visibleCalls(background), "A fading layer is still drawn").toBe(true);
    expect(opacityCalls(background), "Half faded one level out").toBeCloseTo(0.5, 5);
    expect(opacityCalls(overlay), "Scaled by the layer's own opacity").toBeCloseTo(0.4, 5);
  });

  it("Hides the layers once the fade is over", () => {
    const background = stubLayer(1);

    applyBackgroundFade(FULLY_OUT, [background]);

    expect(visibleCalls(background), "Nothing is drawn past the fade").toBe(false);
  });

  it("Respects a layer the product has switched off", () => {
    const hidden = { ...stubLayer(1), visibility: false };

    applyBackgroundFade(ZOOMED_IN, [hidden]);

    expect(visibleCalls(hidden), "The fade does not turn a hidden layer back on").toBe(false);
  });

  it("Skips layers that have no OpenLayers layer yet", () => {
    expect(() => applyBackgroundFade(HALFWAY_OUT, [undefined]), "An absent layer is not an error").not.toThrow();
  });
});
