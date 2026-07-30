import { get as getProjection } from "ol/proj.js";
import { describe, expect, it } from "vitest";

import { isProjectionRegistered, registerProjection } from "@/projections/registerProjection";

// A projection distinct from RD (EPSG:28992), so this suite can't interact with
// rd.test.ts's / createLayer.test.ts's shared module-level registration state.
const LAEA_EUROPE = {
  epsgCode: "EPSG:3035",
  extent: [1896628.62, 1507846.05, 7104179.2, 5416756.29],
  projection: "+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +units=m +no_defs",
};

describe("registerProjection", () => {
  it("is unknown to OpenLayers before registration", () => {
    expect(getProjection(LAEA_EUROPE.epsgCode)).toBeNull();
    expect(isProjectionRegistered(LAEA_EUROPE.epsgCode)).toBe(false);
  });

  it("registers the given EPSG code with OpenLayers", () => {
    registerProjection(LAEA_EUROPE);

    expect(getProjection(LAEA_EUROPE.epsgCode)).not.toBeNull();
    expect(isProjectionRegistered(LAEA_EUROPE.epsgCode)).toBe(true);
  });

  it("is idempotent", () => {
    registerProjection(LAEA_EUROPE);
    registerProjection(LAEA_EUROPE);

    expect(isProjectionRegistered(LAEA_EUROPE.epsgCode)).toBe(true);
  });
});
