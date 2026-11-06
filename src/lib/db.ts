import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// The Neon client is created on first use rather than at import, so code that
// merely imports this module (route config collection during `next build`,
// tests, scripts) doesn't need DATABASE_URL. `sql` behaves exactly like the
// client neon() returns: a tagged template plus helpers like sql.unsafe().
type Sql = NeonQueryFunction<false, false>;

let client: Sql | null = null;

const getClient = (): Sql => {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  return client;
};

export const sql = new Proxy((() => {}) as unknown as Sql, {
  apply: (_target, _this, args: Parameters<Sql>) => getClient()(...args),
  get: (_target, prop) => {
    const value = Reflect.get(getClient(), prop);
    return typeof value === "function" ? value.bind(getClient()) : value;
  },
}) as Sql;
