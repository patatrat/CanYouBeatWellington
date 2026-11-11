import { describe, it, expect, vi, afterEach } from "vitest";
import crypto from "node:crypto";
import { extractSignerKey, fetchActivityJson } from "../http-signatures";
import { NEW_ACTOR } from "../ap-identity";

describe("extractSignerKey", () => {
  const pem = "-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----\n";

  it("reads a Mastodon-style actor, where the key id is the actor plus a fragment", () => {
    const actor = "https://mastodon.example/users/pat";
    const keyId = `${actor}#main-key`;
    const doc = { id: actor, publicKey: { id: keyId, owner: actor, publicKeyPem: pem } };
    expect(extractSignerKey(doc, keyId)).toEqual({ pem, owner: actor });
  });

  it("takes the owner from the document when the key has its own URL", () => {
    const actor = "https://gts.example/users/pat";
    const keyId = `${actor}/main-key`;
    const stub = { id: actor, publicKey: { id: keyId, owner: actor, publicKeyPem: pem } };
    expect(extractSignerKey(stub, keyId).owner).toBe(actor);
  });

  it("reads a bare key object", () => {
    const keyId = "https://example.social/keys/1";
    const doc = { id: keyId, type: "Key", owner: "https://example.social/users/pat", publicKeyPem: pem };
    expect(extractSignerKey(doc, keyId).owner).toBe("https://example.social/users/pat");
  });

  it("falls back to the actor's id when the key names no owner", () => {
    const actor = "https://example.social/users/pat";
    expect(extractSignerKey({ id: actor, publicKey: { publicKeyPem: pem } }, `${actor}#main-key`).owner).toBe(actor);
  });

  it("picks the key matching the keyId when an actor lists several", () => {
    const actor = "https://example.social/users/pat";
    const doc = {
      id: actor,
      publicKey: [
        { id: `${actor}#old`, owner: actor, publicKeyPem: "old" },
        { id: `${actor}#new`, owner: actor, publicKeyPem: "new" },
      ],
    };
    expect(extractSignerKey(doc, `${actor}#new`).pem).toBe("new");
  });

  it("rejects an owner on a different host than the key", () => {
    const keyId = "https://evil.example/users/x#main-key";
    const doc = {
      id: "https://evil.example/users/x",
      publicKey: { id: keyId, owner: "https://mastodon.example/users/pat", publicKeyPem: pem },
    };
    expect(() => extractSignerKey(doc, keyId)).toThrow(/different host/);
  });

  it("rejects documents with no key or no owner", () => {
    expect(() => extractSignerKey(null, "https://a.example/u#k")).toThrow();
    expect(() => extractSignerKey({ id: "https://a.example/u" }, "https://a.example/u#k")).toThrow(/publicKeyPem/);
    expect(() => extractSignerKey({ publicKey: { publicKeyPem: pem } }, "https://a.example/u#k")).toThrow(/owner/);
  });
});

describe("fetchActivityJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("signs the GET as the new actor, verifiable with its public key", async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    vi.stubEnv(NEW_ACTOR.privateKeyEnvVar, privateKey);
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await fetchActivityJson("https://secure.example/users/pat?x=1");

    const headers = (fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }])[1].headers;
    expect(headers.Signature).toContain(`keyId="${NEW_ACTOR.keyId}"`);
    expect(headers.Signature).toContain('headers="(request-target) host date"');
    const sig = headers.Signature.match(/signature="([^"]+)"/)![1];
    const signingString = `(request-target): get /users/pat?x=1\nhost: secure.example\ndate: ${headers.Date}`;
    expect(crypto.verify("sha256", Buffer.from(signingString), publicKey, Buffer.from(sig, "base64"))).toBe(true);
  });

  it("falls back to an unsigned request when no key is configured", async () => {
    vi.stubEnv(NEW_ACTOR.privateKeyEnvVar, "");
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await fetchActivityJson("https://example.social/users/pat");

    const headers = (fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }])[1].headers;
    expect(headers.Signature).toBeUndefined();
    expect(headers.Accept).toContain("application/activity+json");
  });
});
