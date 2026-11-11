import { describe, it, expect } from "vitest";
import {
  classifyDeliveryStatus,
  isRetryable,
  MAX_DELIVERY_ATTEMPTS,
  MAX_RETRY_AGE_MS,
  type RetryEntry,
} from "../ap-posting";

describe("classifyDeliveryStatus", () => {
  it("treats any 2xx as delivered", () => {
    expect(classifyDeliveryStatus(200)).toBe("delivered");
    expect(classifyDeliveryStatus(202)).toBe("delivered");
  });

  it("treats 404 and 410 as a possibly deleted account", () => {
    expect(classifyDeliveryStatus(404)).toBe("gone");
    expect(classifyDeliveryStatus(410)).toBe("gone");
  });

  it("retries timeouts, rate limits and server errors", () => {
    for (const status of [408, 429, 500, 502, 503, 504]) {
      expect(classifyDeliveryStatus(status)).toBe("retry");
    }
  });

  it("doesn't retry a server that refused the activity", () => {
    for (const status of [400, 401, 403, 422]) {
      expect(classifyDeliveryStatus(status)).toBe("failed");
    }
  });
});

describe("isRetryable", () => {
  const now = 1_800_000_000_000;
  const entry = (over: Partial<RetryEntry>): RetryEntry => ({
    actor: "new",
    follower: "https://example.social/users/pat",
    activity: {},
    attempts: 1,
    queuedAt: now,
    ...over,
  });

  it("keeps trying a recent failure with attempts left", () => {
    expect(isRetryable(entry({}), now)).toBe(true);
    expect(isRetryable(entry({ attempts: MAX_DELIVERY_ATTEMPTS - 1 }), now)).toBe(true);
  });

  it("gives up once the attempts are used", () => {
    expect(isRetryable(entry({ attempts: MAX_DELIVERY_ATTEMPTS }), now)).toBe(false);
  });

  it("gives up once the delivery is too old to matter", () => {
    expect(isRetryable(entry({ queuedAt: now - MAX_RETRY_AGE_MS }), now)).toBe(false);
    expect(isRetryable(entry({ queuedAt: now - MAX_RETRY_AGE_MS + 1 }), now)).toBe(true);
  });
});
