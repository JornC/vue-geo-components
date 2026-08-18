import Style from "ol/style/Style.js";
import { describe, expect, it, vi } from "vitest";

import { createHandleFeatureClicked } from "@/layers/featureInteraction";
import {
  NATURE_AREA_AUTHORITY,
  NATURE_AREA_NAME,
  natureAreaExtent,
  natureAreaPointStyle,
  natureAreasToFeatures,
  type NatureArea,
} from "@/layers/natureAreas";

const area: NatureArea = {
  id: "1",
  name: "Veluwe",
  authority: "Gelderland",
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

    it("carries the name and authority as properties", () => {
      const [feature] = natureAreasToFeatures([area]);

      expect(feature?.get(NATURE_AREA_NAME)).toBe("Veluwe");
      expect(feature?.get(NATURE_AREA_AUTHORITY)).toBe("Gelderland");
    });

    it("stores the site extent for zooming to it later", () => {
      const [feature] = natureAreasToFeatures([area]);

      expect(natureAreaExtent(feature)).toEqual([180000, 455000, 190000, 465000]);
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

  describe("natureAreaPointStyle", () => {
    it("is a single dot when not hovered", () => {
      const [feature] = natureAreasToFeatures([area]);

      expect(natureAreaPointStyle(feature!)).toBeInstanceOf(Style);
    });

    it("adds a label when hovered", () => {
      const [feature] = natureAreasToFeatures([area]);
      const styles = natureAreaPointStyle(feature!, true) as Style[];

      expect(Array.isArray(styles)).toBe(true);
      expect(styles.at(-1)?.getText()?.getText()).toBe("Veluwe");
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
