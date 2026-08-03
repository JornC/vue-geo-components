import Polygon from "ol/geom/Polygon.js";
import { describe, expect, it } from "vitest";

import {
  centerFromHexagon,
  centerPointOnReceptor,
  centerPointOnReceptorAtZoom,
  createHexagonFeature,
  isReceptorAtZoomLevel,
  pointFromReceptorId,
  receptorIdFromPoint,
} from "@/receptors/hexagonGrid";

// The south-west origin of the lattice, in RD metres. Receptor 1 sits here by
// definition, which anchors every other assertion in this suite.
const ORIGIN: [number, number] = [3604, 296800];

/** Receptors per lattice row - receptor 1530 is the first of the second row. */
const ROW_LENGTH = 1529;

describe("receptor grid", () => {
  it("places receptor 1 at the lattice origin", () => {
    expect(pointFromReceptorId(1)).toEqual(ORIGIN);
  });

  it("offsets odd rows by one and a half radii", () => {
    const [x, y] = pointFromReceptorId(ROW_LENGTH + 1);

    expect(x).toBeGreaterThan(ORIGIN[0]);
    expect(y).toBeGreaterThan(ORIGIN[1]);
  });

  it("round-trips a receptor id through its coordinate", () => {
    for (const id of [1, 2, 1000, ROW_LENGTH, ROW_LENGTH + 1, ROW_LENGTH * 2, 123456]) {
      const [x, y] = pointFromReceptorId(id);

      expect(receptorIdFromPoint(x, y)).toBe(id);
    }
  });

  it("resolves a point inside a hexagon to that hexagon's receptor", () => {
    const id = 50000;
    const [x, y] = pointFromReceptorId(id);

    // A few metres off-centre is still the same hexagon (the radius is ~62 m).
    expect(receptorIdFromPoint(x + 10, y + 10)).toBe(id);
  });

  describe("snapping a coordinate to a cell centre", () => {
    it("snaps an off-centre point back to its receptor centre", () => {
      const center = pointFromReceptorId(50000);

      expect(centerPointOnReceptor(center[0] + 10, center[1] + 10)).toEqual(center);
    });

    it("leaves a point that is already a centre where it is", () => {
      expect(centerPointOnReceptor(...ORIGIN)).toEqual(ORIGIN);
    });

    it("snaps to the level-1 receptor centre at level 1", () => {
      const center = pointFromReceptorId(50000);
      const [x, y] = centerPointOnReceptorAtZoom(center[0] + 10, center[1] + 10, 1);

      expect(x).toBeCloseTo(center[0], 6);
      expect(y).toBeCloseTo(center[1], 6);
    });

    // Rounding the row before the column picks the wrong hexagon near a cell
    // edge, so probe the whole cell rather than points close to its centre.
    it("agrees with the receptor id round trip anywhere in the lattice", () => {
      for (let i = 0; i < 2000; i++) {
        const x = 5000 + ((i * 7919) % 270000) + (i % 13) * 0.37;
        const y = 300000 + ((i * 6271) % 320000) + (i % 7) * 0.61;
        const viaId = centerPointOnReceptor(x, y);
        const snapped = centerPointOnReceptorAtZoom(x, y, 1);

        expect(snapped[0]).toBeCloseTo(viaId[0], 6);
        expect(snapped[1]).toBeCloseTo(viaId[1], 6);
      }
    });

    it("keeps a cell centre fixed when snapped again at its own level", () => {
      for (const id of [1, 2, 1000, ROW_LENGTH + 1, 50000]) {
        for (const level of [1, 2, 3]) {
          const [x, y] = pointFromReceptorId(id);
          const snapped = centerPointOnReceptorAtZoom(x, y, level);
          const resnapped = centerPointOnReceptorAtZoom(snapped[0], snapped[1], level);

          expect(resnapped[0]).toBeCloseTo(snapped[0], 6);
          expect(resnapped[1]).toBeCloseTo(snapped[1], 6);
        }
      }
    });

    it("anchors a label at the centre of the cell the receptor falls in", () => {
      for (const id of [1, 2, 1000, ROW_LENGTH + 1, 50000]) {
        for (const level of [1, 2, 3]) {
          const [x, y] = pointFromReceptorId(id);
          const anchored = centerFromHexagon(id, level);
          const snapped = centerPointOnReceptorAtZoom(x, y, level);

          expect(anchored).not.toBeNull();
          expect(anchored![0]).toBeCloseTo(snapped[0], 6);
          expect(anchored![1]).toBeCloseTo(snapped[1], 6);
        }
      }
    });
  });

  describe("hexagon geometry", () => {
    it("draws a closed six-cornered ring around the receptor centre", () => {
      const geometry = createHexagonFeature(1).getGeometry() as Polygon;
      const ring = geometry.getCoordinates()[0] ?? [];

      // Six corners plus a repeat of the first to close the ring.
      expect(ring).toHaveLength(7);
      expect(ring[0]).toEqual(ring[6]);
    });

    it("grows the hexagon with the grid level", () => {
      const areaAtLevel = (level: number) => (createHexagonFeature(1, level).getGeometry() as Polygon).getArea();

      // Each level quadruples the covered surface.
      expect(areaAtLevel(2) / areaAtLevel(1)).toBeCloseTo(4, 1);
      expect(areaAtLevel(3) / areaAtLevel(2)).toBeCloseTo(4, 1);
    });
  });

  describe("label anchoring", () => {
    it("anchors a label to the lattice centre for levels that carry labels", () => {
      expect(centerFromHexagon(1, 1)).toEqual(ORIGIN);
    });

    it("carries no label at the levels that aggregate too far", () => {
      expect(centerFromHexagon(1, 4)).toBeNull();
      expect(centerFromHexagon(1, 5)).toBeNull();
    });
  });

  describe("zoom level membership", () => {
    it("recognises a receptor that sits on the level's lattice", () => {
      expect(isReceptorAtZoomLevel(1, 1)).toBe(true);
      expect(isReceptorAtZoomLevel(ROW_LENGTH + 1, 1)).toBe(true);
    });

    it("rejects a receptor that a coarser level aggregates away", () => {
      // Not every level-1 receptor survives as a level-3 lattice centre.
      const survivors = [1, 2, 3, 4, 5, 6, 7, 8].filter((id) => isReceptorAtZoomLevel(id, 3));

      expect(survivors.length).toBeLessThan(8);
    });
  });
});
