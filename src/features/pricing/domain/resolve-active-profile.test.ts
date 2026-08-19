import { describe, expect, it } from "vitest";
import { resolveActiveProfile } from "@/features/pricing/domain/resolve-active-profile";
import type { PricingProfileVersion } from "@/features/pricing/domain/resolve-active-profile";

const ownV1: PricingProfileVersion = {
  channel: "own",
  effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  decomisoPct: "0.10",
  gananciaDeseadaPct: "0.40",
  comisionPlataformaPct: "0.23",
  ivaComisionPct: "0.21",
  comisionTarjetasPct: "0.03",
};

const ownV2: PricingProfileVersion = {
  channel: "own",
  effectiveFrom: new Date("2026-06-01T00:00:00Z"),
  decomisoPct: "0.10",
  gananciaDeseadaPct: "0.35",
  comisionPlataformaPct: "0.23",
  ivaComisionPct: "0.21",
  comisionTarjetasPct: "0.03",
};

const pedidosYaV1: PricingProfileVersion = {
  channel: "pedidosya",
  effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  decomisoPct: "0.10",
  gananciaDeseadaPct: "0.40",
  comisionPlataformaPct: "0.30",
  ivaComisionPct: "0.21",
  comisionTarjetasPct: "0.00",
};

describe("resolveActiveProfile", () => {
  it("returns the latest profile version effective at or before the given date", () => {
    const profiles = [ownV1, ownV2, pedidosYaV1];

    const activo = resolveActiveProfile(profiles, "own", new Date("2026-08-01T00:00:00Z"));

    expect(activo?.gananciaDeseadaPct).toBe("0.35");
  });

  /**
   * Direct test of design decision #7: repricing must NOT rewrite history.
   * An order priced back when v1 was active must still resolve to v1's
   * params even after v2 is added — a new version being ADDED must never
   * change what an OLD date resolves to.
   */
  it("resolves an old order's date to the profile version active THEN, unaffected by a newer version added later", () => {
    const profilesBeforeV2Existed = [ownV1];
    const profilesAfterV2Added = [ownV1, ownV2];

    const fechaDelPedidoAntiguo = new Date("2026-03-15T00:00:00Z");

    const resueltoAntes = resolveActiveProfile(
      profilesBeforeV2Existed,
      "own",
      fechaDelPedidoAntiguo,
    );
    const resueltoDespues = resolveActiveProfile(
      profilesAfterV2Added,
      "own",
      fechaDelPedidoAntiguo,
    );

    expect(resueltoAntes?.gananciaDeseadaPct).toBe("0.40");
    expect(resueltoDespues?.gananciaDeseadaPct).toBe("0.40");
    expect(resueltoDespues).toEqual(resueltoAntes);
  });

  it("selects only the profile for the requested channel, ignoring other channels' versions", () => {
    const profiles = [ownV1, ownV2, pedidosYaV1];

    const activoPedidosYa = resolveActiveProfile(
      profiles,
      "pedidosya",
      new Date("2026-08-01T00:00:00Z"),
    );

    expect(activoPedidosYa?.channel).toBe("pedidosya");
    expect(activoPedidosYa?.comisionPlataformaPct).toBe("0.30");
  });

  it("returns undefined when no profile version is effective yet for that date", () => {
    const profiles = [ownV2];

    const activo = resolveActiveProfile(profiles, "own", new Date("2025-01-01T00:00:00Z"));

    expect(activo).toBeUndefined();
  });
});
