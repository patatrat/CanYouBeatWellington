import { describe, it, expect } from "vitest";
import { getSeverityScenario, pickSeverityQuip, SEVERE_QUIPS, isGreatDay, pickGreatDayQuip, GREAT_DAY_QUIPS } from "../quips";

describe("getSeverityScenario", () => {
  it("returns null for calm, dry conditions", () => {
    expect(getSeverityScenario(15, 0)).toBeNull();
  });

  it("WIND_40: wind >= 40, no rain", () => {
    expect(getSeverityScenario(40, 0)).toBe("WIND_40");
    expect(getSeverityScenario(45, 0)).toBe("WIND_40");
  });

  it("WIND_40_RAIN: any rain in the 40-49 wind band beats plain WIND_40", () => {
    expect(getSeverityScenario(40, 0.1)).toBe("WIND_40_RAIN");
    expect(getSeverityScenario(49, 5)).toBe("WIND_40_RAIN");
  });

  it("WIND_50: wind >= 50 wins outright, even with heavy rain", () => {
    expect(getSeverityScenario(50, 0)).toBe("WIND_50");
    expect(getSeverityScenario(55, 30)).toBe("WIND_50");
  });

  it("WIND_60: wind >= 60 wins outright, even with heavy rain", () => {
    expect(getSeverityScenario(60, 0)).toBe("WIND_60");
    expect(getSeverityScenario(70, 40)).toBe("WIND_60");
  });

  it("RAIN_HEAVY: rain >= 25 fires once wind is below the WIND_40 floor", () => {
    expect(getSeverityScenario(10, 25)).toBe("RAIN_HEAVY");
    expect(getSeverityScenario(35, 30)).toBe("RAIN_HEAVY");
  });

  it("RAIN_STEADY_CALM: rain 10-24.9 and wind < 30", () => {
    expect(getSeverityScenario(20, 10)).toBe("RAIN_STEADY_CALM");
    expect(getSeverityScenario(29.9, 24.9)).toBe("RAIN_STEADY_CALM");
  });

  it("does not fire RAIN_STEADY_CALM once wind reaches 30, falling through to null", () => {
    expect(getSeverityScenario(30, 15)).toBeNull();
  });
});

describe("pickSeverityQuip", () => {
  it("returns a quip from the matching bucket", () => {
    const quip = pickSeverityQuip(65, 0);
    expect(SEVERE_QUIPS.WIND_60).toContain(quip);
  });

  it("returns null when no severity tier matches", () => {
    expect(pickSeverityQuip(10, 0)).toBeNull();
  });
});

describe("isGreatDay", () => {
  const minTemp = 19;

  it("true when temp is 3+ above minimum, wind < 20, no rain", () => {
    expect(isGreatDay({ temperature: 22, windSpeed: 19.9, rain: 0 }, minTemp)).toBe(true);
  });

  it("false when temp is just under the +3 margin", () => {
    expect(isGreatDay({ temperature: 21.9, windSpeed: 10, rain: 0 }, minTemp)).toBe(false);
  });

  it("false when wind is at or above 20", () => {
    expect(isGreatDay({ temperature: 25, windSpeed: 20, rain: 0 }, minTemp)).toBe(false);
  });

  it("false when it's raining, even if temp and wind qualify", () => {
    expect(isGreatDay({ temperature: 25, windSpeed: 5, rain: 0.1 }, minTemp)).toBe(false);
  });
});

describe("pickGreatDayQuip", () => {
  it("returns a quip from the great-day list", () => {
    expect(GREAT_DAY_QUIPS).toContain(pickGreatDayQuip());
  });
});
