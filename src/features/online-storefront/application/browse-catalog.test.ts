import { describe, expect, it, vi, beforeEach } from "vitest";

const { listAvailableFlavorsMock, listPacksMock, listChoosableFlavorsForPackMock } = vi.hoisted(
  () => ({
    listAvailableFlavorsMock: vi.fn(),
    listPacksMock: vi.fn(),
    listChoosableFlavorsForPackMock: vi.fn(),
  }),
);

vi.mock("@/features/product-catalog/infrastructure/product-catalog.repository", () => ({
  listAvailableFlavors: listAvailableFlavorsMock,
  listPacks: listPacksMock,
  listChoosableFlavorsForPack: listChoosableFlavorsForPackMock,
}));

const { browseAvailableFlavors, browsePacks, browsePackFlavorOptions } =
  await import("@/features/online-storefront/application/browse-catalog");

/**
 * Public storefront catalog browsing (spec capability "online-storefront").
 * Unlike every prior mutating use-case in this project, browsing is a
 * read-only query reachable by an anonymous customer — no `requireRole`/
 * `requireSession` call, by design (spec scenario "Toggle hides from
 * storefront" requires the change be visible storefront-wide immediately,
 * to anyone, not just logged-in staff).
 */
describe("browse-catalog (public, no auth)", () => {
  beforeEach(() => {
    listAvailableFlavorsMock.mockReset();
    listPacksMock.mockReset();
    listChoosableFlavorsForPackMock.mockReset();
  });

  it("browseAvailableFlavors delegates to listAvailableFlavors (respects is_available)", async () => {
    const flavors = [{ id: "flavor-1", isAvailable: true }];
    listAvailableFlavorsMock.mockResolvedValueOnce(flavors);

    const result = await browseAvailableFlavors();

    expect(listAvailableFlavorsMock).toHaveBeenCalledWith();
    expect(result).toBe(flavors);
  });

  it("browsePacks delegates to listPacks", async () => {
    const packs = [{ id: "pack-1", unitCount: 12 }];
    listPacksMock.mockResolvedValueOnce(packs);

    const result = await browsePacks();

    expect(listPacksMock).toHaveBeenCalledWith();
    expect(result).toBe(packs);
  });

  it("browsePackFlavorOptions delegates to listChoosableFlavorsForPack (eligible AND available only)", async () => {
    const choosable = [{ id: "flavor-1", isAvailable: true }];
    listChoosableFlavorsForPackMock.mockResolvedValueOnce(choosable);

    const result = await browsePackFlavorOptions("pack-1");

    expect(listChoosableFlavorsForPackMock).toHaveBeenCalledWith("pack-1");
    expect(result).toBe(choosable);
  });
});
