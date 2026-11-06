import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { neon } from "@neondatabase/serverless";

// db.ts creates its client on first use, so each test re-imports a fresh copy.
const freshDb = async () => {
  vi.resetModules();
  return import("../db");
};

describe("sql (lazy Neon client)", () => {
  const original = process.env.DATABASE_URL;
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  });

  it("can be imported without DATABASE_URL", async () => {
    await expect(freshDb()).resolves.toHaveProperty("sql");
  });

  it("says what's missing when queried without DATABASE_URL", async () => {
    const { sql } = await freshDb();
    expect(() => sql`select 1`).toThrow("DATABASE_URL is not set");
  });

  it("passes helpers like sql.unsafe() through to the real client", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@example.invalid/db";
    const { sql } = await freshDb();
    const direct = neon(process.env.DATABASE_URL);
    expect(JSON.stringify(sql.unsafe("id, name"))).toBe(JSON.stringify(direct.unsafe("id, name")));
  });
});
