import { describe, expect, it } from "vitest";

import {
  BASE_LAYER_GROUP,
  PdokBackgroundVariant,
  createPdokAerialLayer,
  createPdokBackgroundLayer,
  createPdokProvinceBoundaryLayer,
} from "@/layers/pdok";
import { LayerType } from "@/layers/types";
import { RD } from "@/projections/rd";

describe("PDOK layers", () => {
  describe("background", () => {
    it("asks the BRT service for the requested variant", () => {
      const layer = createPdokBackgroundLayer({ name: "Achtergrondkaart", variant: PdokBackgroundVariant.GREY });

      expect(layer.type).toBe(LayerType.WMTS);
      expect(layer.url).toContain("brt/achtergrondkaart");
      expect(layer.layer).toBe("grijs");
    });

    it("defaults to RD and starts hidden", () => {
      const layer = createPdokBackgroundLayer({ name: "Achtergrondkaart", variant: PdokBackgroundVariant.STANDARD });

      expect(layer.matrixSet).toBe(RD);
      expect(layer.visibility).toBe(false);
    });

    it("accepts another projection", () => {
      const layer = createPdokBackgroundLayer({ name: "x", variant: PdokBackgroundVariant.WATER, epsgCode: "EPSG:3857" });

      expect(layer.matrixSet).toBe("EPSG:3857");
    });

    it("groups base layers so only one shows at a time", () => {
      const grey = createPdokBackgroundLayer({ name: "grey", variant: PdokBackgroundVariant.GREY });
      const aerial = createPdokAerialLayer({ name: "aerial" });

      expect(grey.group).toBe(BASE_LAYER_GROUP);
      expect(aerial.group).toBe(BASE_LAYER_GROUP);
    });
  });

  describe("aerial", () => {
    it("asks the aerial service for the current orthophoto", () => {
      const layer = createPdokAerialLayer({ name: "Luchtfoto" });

      expect(layer.url).toContain("luchtfotorgb");
      expect(layer.layer).toBe("Actueel_ortho25");
      // The aerial service publishes no 8-bit variant.
      expect(layer.format).toBe("image/png");
    });
  });

  describe("province boundaries", () => {
    const style = () => undefined;

    it("requests the generalised province features over WFS", () => {
      const layer = createPdokProvinceBoundaryLayer({ name: "Provinciegrenzen", styleFunction: style, year: 2026 });

      expect(layer.type).toBe(LayerType.WFS);
      expect(layer.layer).toBe("provincie_gegeneraliseerd");
      expect(layer.styleFunction).toBe(style);
    });

    it("addresses the service edition the caller asked for", () => {
      expect(createPdokProvinceBoundaryLayer({ name: "x", styleFunction: style, year: 2026 }).url).toContain("/2026/");
      expect(createPdokProvinceBoundaryLayer({ name: "x", styleFunction: style, year: 2020 }).url).toContain("/2020/");
    });
  });
});
