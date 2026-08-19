export interface SeedAdminArgs {
  name: string;
  email: string;
  password: string;
  role: "admin" | "colaborador";
}

/**
 * Pure CLI-arg parser for the admin/colaborador provisioning script (Phase
 * 4, task 4.2 — design decision #4's rationale: accounts are
 * admin-provisioned, there is no public signup form). Kept free of any
 * DB/bcrypt I/O so it is unit-testable with zero mocks; `scripts/seed-admin.ts`
 * is the thin executable wrapper that calls this and then performs the
 * actual upsert against the real Neon DB.
 */
export function parseSeedAdminArgs(argv: string[]): SeedAdminArgs {
  const flags = new Map<string, string>();

  for (const arg of argv) {
    const match = /^--([a-z]+)=(.*)$/.exec(arg);
    if (match) {
      flags.set(match[1], match[2]);
    }
  }

  const name = flags.get("name");
  const email = flags.get("email");
  const password = flags.get("password");
  const role = flags.get("role") ?? "colaborador";

  if (!name || !email || !password) {
    throw new Error(
      "Usage: --name=<name> --email=<email> --password=<password> [--role=admin|colaborador]",
    );
  }

  if (role !== "admin" && role !== "colaborador") {
    throw new Error(`Invalid --role "${role}" — must be "admin" or "colaborador".`);
  }

  return { name, email, password, role };
}
