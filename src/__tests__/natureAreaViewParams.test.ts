import { describe, expect, it } from "vitest";

import { natureAreaViewParams } from "@/layers/fameNatureAreas";

describe("Choosing which nature areas to draw", () => {
  it("Asks for every site when none are named", () => {
    expect(decodeURIComponent(natureAreaViewParams("m25")), "No selection means the whole country").toBe("dataset:m25");
  });

  it("Narrows to the one site a product asked for", () => {
    expect(decodeURIComponent(natureAreaViewParams("m25", () => ["57"])), "FAME takes the code as a viewparam").toBe(
      "dataset:m25;natura2000AreaCode:57",
    );
  });

  it("Refuses more sites than FAME can draw", () => {
    expect(
      () => natureAreaViewParams("m25", () => ["57", "38"]),
      "Drawing one of three silently would read as missing data rather than a mistake",
    ).toThrow();
  });
});
