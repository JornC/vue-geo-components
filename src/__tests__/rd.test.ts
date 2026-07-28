import { get as getProjection } from "ol/proj.js";
import { describe, expect, it } from "vitest";

import { RD, isRdRegistered, registerRdProjection } from "@/projections/rd";

describe("RD projection", () => {
  it("is unknown to OpenLayers before registration", () => {
    expect(getProjection(RD)).toBeNull();
    expect(isRdRegistered()).toBe(false);
  });

  it("registers EPSG:28992 with OpenLayers", () => {
    registerRdProjection();

    expect(getProjection(RD)).not.toBeNull();
    expect(isRdRegistered()).toBe(true);
  });

  it("is idempotent", () => {
    registerRdProjection();
    registerRdProjection();

    expect(isRdRegistered()).toBe(true);
  });
});
