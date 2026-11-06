import { describe, it, expect } from "vitest";
import { DISAGREE_REASONS, isValidReason, isVerdict } from "../disagree-reasons";

describe("disagree reasons", () => {
  it("accepts only the reasons offered for that verdict", () => {
    expect(isValidReason("good", "too_windy")).toBe(true);
    expect(isValidReason("bad", "wind_ok")).toBe(true);
    // A bad-day reason can't be filed against a good day, or vice versa.
    expect(isValidReason("good", "wind_ok")).toBe(false);
    expect(isValidReason("bad", "too_windy")).toBe(false);
  });

  it("rejects anything that isn't a listed key", () => {
    expect(isValidReason("good", "Too windy")).toBe(false);
    expect(isValidReason("good", "")).toBe(false);
    expect(isValidReason("good", undefined)).toBe(false);
    expect(isValidReason("good", { key: "too_windy" })).toBe(false);
  });

  it("offers Other as a plain option on both prompts, with no free text", () => {
    expect(isValidReason("good", "other")).toBe(true);
    expect(isValidReason("bad", "other")).toBe(true);
  });

  it("only recognises good and bad as verdicts", () => {
    expect(isVerdict("good")).toBe(true);
    expect(isVerdict("bad")).toBe(true);
    expect(isVerdict("Good")).toBe(false);
    expect(isVerdict(null)).toBe(false);
  });

  it("keeps every key short and unique within its prompt", () => {
    for (const prompt of Object.values(DISAGREE_REASONS)) {
      const keys = prompt.options.map((o) => o.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const key of keys) expect(key).toMatch(/^[a-z_]{1,20}$/);
    }
  });
});
