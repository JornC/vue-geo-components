import { describe, expect, it, vi } from "vitest";

import { createHandleFeatureClicked } from "@/layers/featureInteraction";
import { NATURE_AREA_EXTENT, NATURE_AREA_NAME, natureAreasToFeatures, type NatureArea } from "@/layers/natureAreas";

const area: NatureArea = {
  id: "1",
  name: "Veluwe",
  interiorPointWkt: "POINT(185000 460000)",
  extentWkt: "POLYGON((180000 455000, 190000 455000, 190000 465000, 180000 465000, 180000 455000))",
};

describe("nature areas", () => {
  describe("natureAreasToFeatures", () => {
    it("draws a site at its interior point and remembers its id", () => {
      const [feature] = natureAreasToFeatures([area]);

      expect(feature?.getId()).toBe("1");
      expect(feature?.getGeometry()?.getType()).toBe("Point");
    });

    it("carries the name as a property", () => {
      const [feature] = natureAreasToFeatures([area]);

      expect(feature?.get(NATURE_AREA_NAME)).toBe("Veluwe");
    });

    it("stores the site extent for zooming to it later", () => {
      const [feature] = natureAreasToFeatures([area]);

      expect(feature?.get(NATURE_AREA_EXTENT)).toEqual([180000, 455000, 190000, 465000]);
    });

    it("skips an unreadable site rather than losing the batch, and says so", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      const features = natureAreasToFeatures([{ ...area, id: "bad", interiorPointWkt: "NOT WKT" }, area]);

      expect(features).toHaveLength(1);
      expect(features[0]?.getId()).toBe("1");
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("bad"), expect.anything());

      warn.mockRestore();
    });
  });
});

describe("createHandleFeatureClicked", () => {
  it("hands over the first feature carrying the key", () => {
    const seen: unknown[] = [];
    const handle = createHandleFeatureClicked((feature) => seen.push(feature?.get(NATURE_AREA_NAME)), NATURE_AREA_NAME);
    const [feature] = natureAreasToFeatures([area]);

    handle([feature!]);

    expect(seen).toEqual(["Veluwe"]);
  });

  it("reports nothing when the click missed every matching feature", () => {
    const seen: unknown[] = [];
    const handle = createHandleFeatureClicked((feature) => seen.push(feature), "somethingElse");
    const [feature] = natureAreasToFeatures([area]);

    handle([feature!]);

    expect(seen).toEqual([undefined]);
  });
});
