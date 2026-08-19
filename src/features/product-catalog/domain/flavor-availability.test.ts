import { describe, expect, it } from "vitest";
import { filterAvailable } from "@/features/product-catalog/domain/flavor-availability";

describe("filterAvailable", () => {
  it("keeps only flavors marked available", () => {
    const flavors = [
      { id: "1", isAvailable: true },
      { id: "2", isAvailable: false },
      { id: "3", isAvailable: true },
    ];

    const result = filterAvailable(flavors);

    expect(result.map((f) => f.id)).toEqual(["1", "3"]);
  });

  it("returns an empty array when every flavor is unavailable", () => {
    const flavors = [
      { id: "1", isAvailable: false },
      { id: "2", isAvailable: false },
    ];

    const result = filterAvailable(flavors);

    expect(result).toEqual([]);
  });
});
