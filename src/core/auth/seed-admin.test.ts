import { describe, expect, it } from "vitest";
import { parseSeedAdminArgs } from "@/core/auth/seed-admin";

describe("parseSeedAdminArgs", () => {
  it("parses name/email/password/role from --key=value flags", () => {
    const result = parseSeedAdminArgs([
      "--name=Ana",
      "--email=ana@rinconempanadero.com",
      "--password=s3cret!",
      "--role=admin",
    ]);

    expect(result).toEqual({
      name: "Ana",
      email: "ana@rinconempanadero.com",
      password: "s3cret!",
      role: "admin",
    });
  });

  it("defaults role to colaborador when --role is omitted", () => {
    const result = parseSeedAdminArgs([
      "--name=Bruno",
      "--email=bruno@rinconempanadero.com",
      "--password=otraClave",
    ]);

    expect(result.role).toBe("colaborador");
  });

  it("throws a usage error when a required flag is missing", () => {
    expect(() => parseSeedAdminArgs(["--name=Ana", "--email=ana@rinconempanadero.com"])).toThrow(
      /Usage:/,
    );
  });

  it("throws when --role is neither admin nor colaborador", () => {
    expect(() =>
      parseSeedAdminArgs([
        "--name=Ana",
        "--email=ana@rinconempanadero.com",
        "--password=x",
        "--role=superadmin",
      ]),
    ).toThrow(/Invalid --role/);
  });
});
