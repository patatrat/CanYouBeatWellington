import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";

const cache = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@vercel/kv", () => ({
  kv: {
    get: async (k: string) => cache.get(k) ?? null,
    set: async (k: string, v: unknown) => void cache.set(k, v),
  },
}));

import { verifySignature, parseMessageSignature } from "../http-signatures";

const ACTOR = "https://mastodon.example/users/pat";
const KEY_ID = `${ACTOR}#main-key`;
const HOST = "canyoubeatwellington.nz";
const PATH = "/actor/inbox";
const BODY = JSON.stringify({ type: "Like", actor: ACTOR });

const rsa = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const ed = crypto.generateKeyPairSync("ed25519");
const pem = (key: crypto.KeyObject) => key.export({ type: "spki", format: "pem" }) as string;

const useKey = (publicKey: crypto.KeyObject) => cache.set(`cybw:ap:key:${KEY_ID}`, { pem: pem(publicKey), owner: ACTOR });

const nowSeconds = () => Math.floor(Date.now() / 1000);
const contentDigest = (body: string) => `sha-256=:${crypto.createHash("sha256").update(body).digest("base64")}:`;

// Builds an RFC 9421 request the way Mastodon signs one.
function signed9421(opts: { created?: number; body?: string; privateKey?: crypto.KeyObject; extraParams?: string } = {}) {
  const body = opts.body ?? BODY;
  const params = `("@method" "@target-uri" "content-digest");created=${opts.created ?? nowSeconds()};keyid="${KEY_ID}"${opts.extraParams ?? ""}`;
  const digest = contentDigest(body);
  const base = [
    `"@method": POST`,
    `"@target-uri": https://${HOST}${PATH}`,
    `"content-digest": ${digest}`,
    `"@signature-params": ${params}`,
  ].join("\n");
  const key = opts.privateKey ?? rsa.privateKey;
  const sig =
    key.asymmetricKeyType === "ed25519"
      ? crypto.sign(null, Buffer.from(base), key)
      : crypto.sign("sha256", Buffer.from(base), { key, padding: crypto.constants.RSA_PKCS1_PADDING });
  return {
    host: HOST,
    "content-digest": digest,
    "signature-input": `sig1=${params}`,
    signature: `sig1=:${sig.toString("base64")}:`,
  };
}

function signedCavage(body = BODY) {
  const date = new Date().toUTCString();
  const digest = `SHA-256=${crypto.createHash("sha256").update(body).digest("base64")}`;
  const signingString = `(request-target): post ${PATH}\nhost: ${HOST}\ndate: ${date}\ndigest: ${digest}`;
  const sig = crypto
    .sign("sha256", Buffer.from(signingString), { key: rsa.privateKey, padding: crypto.constants.RSA_PKCS1_PADDING })
    .toString("base64");
  return {
    host: HOST,
    date,
    digest,
    signature: `keyId="${KEY_ID}",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="${sig}"`,
  };
}

beforeEach(() => {
  cache.clear();
  useKey(rsa.publicKey);
  // A stale cached key triggers one fresh fetch; make that fail cleanly.
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 410 })));
});
afterEach(() => vi.unstubAllGlobals());

describe("verifySignature — draft-cavage (what nearly everything sends)", () => {
  it("accepts a valid signature and returns the key's owner", async () => {
    expect(await verifySignature("POST", PATH, signedCavage(), BODY)).toBe(ACTOR);
  });

  it("rejects a body that doesn't match the signed digest", async () => {
    await expect(verifySignature("POST", PATH, signedCavage(), BODY + " ")).rejects.toThrow(/Digest/);
  });
});

describe("verifySignature — RFC 9421", () => {
  it("accepts a Mastodon-style signature and returns the key's owner", async () => {
    expect(await verifySignature("POST", PATH, signed9421(), BODY)).toBe(ACTOR);
  });

  it("accepts an Ed25519 key", async () => {
    useKey(ed.publicKey);
    expect(await verifySignature("POST", PATH, signed9421({ privateKey: ed.privateKey }), BODY)).toBe(ACTOR);
  });

  it("accepts a declared rsa-v1_5-sha256 algorithm and rejects an unsupported one", async () => {
    expect(await verifySignature("POST", PATH, signed9421({ extraParams: ';alg="rsa-v1_5-sha256"' }), BODY)).toBe(ACTOR);
    await expect(
      verifySignature("POST", PATH, signed9421({ extraParams: ';alg="hmac-sha256"' }), BODY),
    ).rejects.toThrow(/Unsupported signature algorithm/);
  });

  it("rejects a body that doesn't match the signed digest", async () => {
    await expect(verifySignature("POST", PATH, signed9421(), BODY + " ")).rejects.toThrow(/Content-Digest/);
  });

  it("rejects a signature made by a different key", async () => {
    const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    await expect(
      verifySignature("POST", PATH, signed9421({ privateKey: other.privateKey }), BODY),
    ).rejects.toThrow();
  });

  it("rejects a signature replayed at a different path or host", async () => {
    await expect(verifySignature("POST", "/other/inbox", signed9421(), BODY)).rejects.toThrow();
    await expect(
      verifySignature("POST", PATH, { ...signed9421(), host: "canyoubeatwellington.radomski.co.nz" }, BODY),
    ).rejects.toThrow();
  });

  it("rejects a stale or expired signature", async () => {
    await expect(
      verifySignature("POST", PATH, signed9421({ created: nowSeconds() - 2 * 60 * 60 }), BODY),
    ).rejects.toThrow(/acceptance window/);
    await expect(
      verifySignature("POST", PATH, signed9421({ extraParams: `;expires=${nowSeconds() - 10}` }), BODY),
    ).rejects.toThrow(/expired/);
  });

  it("rejects a signature that doesn't cover the body digest or the URL", async () => {
    const headers = signed9421();
    const weak = (list: string) => ({
      ...headers,
      "signature-input": `sig1=(${list});created=${nowSeconds()};keyid="${KEY_ID}"`,
    });
    await expect(verifySignature("POST", PATH, weak('"@method" "@target-uri"'), BODY)).rejects.toThrow(/content-digest/);
    await expect(verifySignature("POST", PATH, weak('"@method" "content-digest"'), BODY)).rejects.toThrow(/@target-uri/);
  });
});

describe("parseMessageSignature", () => {
  it("parses Mastodon's documented example", () => {
    const parsed = parseMessageSignature(
      'sig1=("@method" "@target-uri" "content-digest");created=1748341414;keyid="https://my.example.com/actor#main-key"',
      "sig1=:Y2FiYW==:",
    );
    expect(parsed.components).toEqual(["@method", "@target-uri", "content-digest"]);
    expect(parsed.keyId).toBe("https://my.example.com/actor#main-key");
    expect(parsed.created).toBe(1748341414);
    expect(parsed.params).toBe(
      '("@method" "@target-uri" "content-digest");created=1748341414;keyid="https://my.example.com/actor#main-key"',
    );
  });

  it("rejects missing created/keyid, a mismatched label, and more than one signature", () => {
    expect(() => parseMessageSignature('sig1=("@method");keyid="https://a.example/k"', "sig1=:AAAA:")).toThrow(/created/);
    expect(() => parseMessageSignature('sig1=("@method");created=1', "sig1=:AAAA:")).toThrow(/keyid/);
    expect(() => parseMessageSignature('sig1=("@method");created=1;keyid="https://a.example/k"', "sig2=:AAAA:")).toThrow(/Signature header/);
    expect(() =>
      parseMessageSignature('sig1=("@method");created=1;keyid="k", sig2=("@method");created=1;keyid="k"', "sig1=:AAAA:"),
    ).toThrow(/Signature-Input/);
  });
});
