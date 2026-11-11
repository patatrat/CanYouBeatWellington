import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";

// A tiny in-memory stand-in for the KV commands delivery uses.
const store = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  sets: new Map<string, Set<string>>(),
  lists: new Map<string, unknown[]>(),
}));

vi.mock("@vercel/kv", () => ({
  kv: {
    get: async (k: string) => store.values.get(k) ?? null,
    set: async (k: string, v: unknown) => void store.values.set(k, v),
    del: async (k: string) => void store.values.delete(k),
    smembers: async (k: string) => [...(store.sets.get(k) ?? [])],
    sismember: async (k: string, m: string) => (store.sets.get(k)?.has(m) ? 1 : 0),
    srem: async (k: string, m: string) => void store.sets.get(k)?.delete(m),
    llen: async (k: string) => store.lists.get(k)?.length ?? 0,
    rpush: async (k: string, ...items: unknown[]) => {
      store.lists.set(k, [...(store.lists.get(k) ?? []), ...items]);
    },
    lpop: async (k: string, count: number) => (store.lists.get(k) ?? []).splice(0, count),
    ltrim: async () => undefined,
  },
}));

import { deliverToFollowers, retryFailedDeliveries, MAX_DELIVERY_ATTEMPTS } from "../ap-posting";
import { NEW_ACTOR } from "../ap-identity";

const QUEUE = "cybw:ap:delivery-retries";
const { privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const follower = (name: string) => `https://${name}.example/users/x`;
const activity = { id: "https://canyoubeatwellington.nz/notes/test/activity", type: "Create" };

// Each server's behaviour: what its actor GET and its inbox POST answer.
let servers: Record<string, { actor?: number; inbox: number | "timeout" }>;

beforeEach(() => {
  store.values.clear();
  store.sets.clear();
  store.lists.clear();
  servers = {};
  vi.stubEnv(NEW_ACTOR.privateKeyEnvVar, privateKey);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string }) => {
      const host = new URL(url).host.replace(".example", "");
      const server = servers[host];
      if (init?.method === "POST") {
        if (server.inbox === "timeout") throw new Error("timeout");
        return new Response(null, { status: server.inbox });
      }
      const status = server.actor ?? 200;
      return new Response(JSON.stringify({ inbox: `https://${host}.example/inbox` }), { status });
    }),
  );
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const follow = (...names: string[]) => store.sets.set(NEW_ACTOR.followersKey, new Set(names.map(follower)));
const followers = () => [...(store.sets.get(NEW_ACTOR.followersKey) ?? [])];
const queue = () => (store.lists.get(QUEUE) ?? []) as { follower: string; attempts: number }[];

describe("deliverToFollowers", () => {
  it("delivers, queues a temporary failure, drops a refusal and removes a deleted account", async () => {
    follow("ok", "down", "refused", "deleted");
    servers = {
      ok: { inbox: 202 },
      down: { inbox: 503 },
      refused: { inbox: 403 },
      deleted: { inbox: 404, actor: 200 },
    };
    // The deleted account's inbox URL was cached while it still existed.
    store.values.set(`cybw:ap:inbox:${follower("deleted")}`, "https://deleted.example/inbox");
    servers.deleted.actor = 410;

    const result = await deliverToFollowers(activity, privateKey, NEW_ACTOR);

    expect(result).toEqual({ delivered: 1, failed: 3, total: 4, removed: 1, queued: 1 });
    expect(followers().sort()).toEqual([follower("down"), follower("ok"), follower("refused")].sort());
    expect(queue()).toMatchObject([{ follower: follower("down"), attempts: 1, actor: "new" }]);
  });

  it("keeps a follower whose inbox 404s while their account still exists, and retries", async () => {
    follow("moved-inbox");
    servers = { "moved-inbox": { inbox: 404, actor: 200 } };
    store.values.set(`cybw:ap:inbox:${follower("moved-inbox")}`, "https://moved-inbox.example/old-inbox");

    const result = await deliverToFollowers(activity, privateKey, NEW_ACTOR);

    expect(result).toMatchObject({ delivered: 0, removed: 0, queued: 1 });
    expect(followers()).toEqual([follower("moved-inbox")]);
    expect(store.values.has(`cybw:ap:inbox:${follower("moved-inbox")}`)).toBe(false);
  });

  it("queues a timeout", async () => {
    follow("slow");
    servers = { slow: { inbox: "timeout" } };
    expect(await deliverToFollowers(activity, privateKey, NEW_ACTOR)).toMatchObject({ queued: 1 });
  });
});

describe("retryFailedDeliveries", () => {
  it("delivers once the server is back and empties the queue", async () => {
    follow("down");
    servers = { down: { inbox: 503 } };
    await deliverToFollowers(activity, privateKey, NEW_ACTOR);

    servers.down.inbox = 202;
    expect(await retryFailedDeliveries()).toEqual({ retried: 1, delivered: 1, requeued: 0, dropped: 0 });
    expect(queue()).toEqual([]);
  });

  it("re-queues while it keeps failing, then gives up after the last attempt", async () => {
    follow("down");
    servers = { down: { inbox: 503 } };
    await deliverToFollowers(activity, privateKey, NEW_ACTOR);

    for (let attempt = 2; attempt < MAX_DELIVERY_ATTEMPTS; attempt++) {
      expect(await retryFailedDeliveries()).toMatchObject({ retried: 1, requeued: 1, dropped: 0 });
      expect(queue()[0].attempts).toBe(attempt);
    }
    expect(await retryFailedDeliveries()).toMatchObject({ retried: 1, requeued: 0, dropped: 1 });
    expect(queue()).toEqual([]);
    expect(await retryFailedDeliveries()).toEqual({ retried: 0, delivered: 0, requeued: 0, dropped: 0 });
  });

  it("drops a queued delivery for someone who has since unfollowed", async () => {
    follow("down");
    servers = { down: { inbox: 503 } };
    await deliverToFollowers(activity, privateKey, NEW_ACTOR);

    follow();
    expect(await retryFailedDeliveries()).toEqual({ retried: 0, delivered: 0, requeued: 0, dropped: 1 });
  });
});
