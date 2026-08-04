import { describe, it, expect } from "vitest";
import {
  getSeverityScenario,
  pickSeverityQuip,
  SEVERE_QUIPS,
  isGreatDay,
  pickGreatDayQuip,
  GREAT_DAY_QUIPS,
  type SeverityWeather,
} from "../quips";

// Calm/dry/mild baseline — each test overrides only the fields it cares about.
const weather = (overrides: Partial<SeverityWeather> = {}): SeverityWeather => ({
  windSpeed: 10,
  rain: 0,
  snowfall: 0,
  feelsLike: 10,
  ...overrides,
});

describe("getSeverityScenario", () => {
  it("returns null for calm, dry, mild conditions", () => {
    expect(getSeverityScenario(weather())).toBeNull();
  });

  it("SNOW: any snowfall wins outright, even over extreme wind and rain", () => {
    expect(getSeverityScenario(weather({ snowfall: 0.1 }))).toBe("SNOW");
    expect(getSeverityScenario(weather({ snowfall: 2, windSpeed: 65, rain: 30 }))).toBe("SNOW");
  });

  it("WIND_40: wind >= 40, no rain or a light shower (<= 5mm)", () => {
    expect(getSeverityScenario(weather({ windSpeed: 40 }))).toBe("WIND_40");
    expect(getSeverityScenario(weather({ windSpeed: 45 }))).toBe("WIND_40");
    expect(getSeverityScenario(weather({ windSpeed: 40, rain: 5 }))).toBe("WIND_40");
  });

  it("WIND_40_RAIN: rain over 5mm in the 40-49 wind band beats plain WIND_40", () => {
    expect(getSeverityScenario(weather({ windSpeed: 40, rain: 5.1 }))).toBe("WIND_40_RAIN");
    expect(getSeverityScenario(weather({ windSpeed: 49, rain: 20 }))).toBe("WIND_40_RAIN");
  });

  it("WIND_50: wind >= 50 wins outright, even with heavy rain", () => {
    expect(getSeverityScenario(weather({ windSpeed: 50 }))).toBe("WIND_50");
    expect(getSeverityScenario(weather({ windSpeed: 55, rain: 30 }))).toBe("WIND_50");
  });

  it("WIND_60: wind >= 60 wins outright, even with heavy rain", () => {
    expect(getSeverityScenario(weather({ windSpeed: 60 }))).toBe("WIND_60");
    expect(getSeverityScenario(weather({ windSpeed: 70, rain: 40 }))).toBe("WIND_60");
  });

  it("FEELS_LIKE_COLD: feels-like below 0, once wind isn't already severe", () => {
    expect(getSeverityScenario(weather({ feelsLike: -0.1 }))).toBe("FEELS_LIKE_COLD");
    expect(getSeverityScenario(weather({ feelsLike: -7 }))).toBe("FEELS_LIKE_COLD");
  });

  it("a severe wind reading beats FEELS_LIKE_COLD even when both apply", () => {
    expect(getSeverityScenario(weather({ windSpeed: 40, feelsLike: -5 }))).toBe("WIND_40");
  });

  it("FEELS_LIKE_COLD beats heavy rain when both apply", () => {
    expect(getSeverityScenario(weather({ feelsLike: -2, rain: 30 }))).toBe("FEELS_LIKE_COLD");
  });

  it("RAIN_HEAVY: rain >= 25 fires once wind and feels-like are not severe", () => {
    expect(getSeverityScenario(weather({ rain: 25 }))).toBe("RAIN_HEAVY");
    expect(getSeverityScenario(weather({ windSpeed: 35, rain: 30 }))).toBe("RAIN_HEAVY");
  });

  it("RAIN_STEADY_CALM: rain 10-24.9 and wind < 30", () => {
    expect(getSeverityScenario(weather({ windSpeed: 20, rain: 10 }))).toBe("RAIN_STEADY_CALM");
    expect(getSeverityScenario(weather({ windSpeed: 29.9, rain: 24.9 }))).toBe("RAIN_STEADY_CALM");
  });

  it("does not fire RAIN_STEADY_CALM once wind reaches 30, falling through to null", () => {
    expect(getSeverityScenario(weather({ windSpeed: 30, rain: 15 }))).toBeNull();
  });
});

describe("pickSeverityQuip", () => {
  it("returns a quip from the matching bucket", () => {
    const quip = pickSeverityQuip(weather({ windSpeed: 65 }));
    expect(SEVERE_QUIPS.WIND_60).toContain(quip);
  });

  it("returns a snow quip when it's snowing", () => {
    const quip = pickSeverityQuip(weather({ snowfall: 1 }));
    expect(SEVERE_QUIPS.SNOW).toContain(quip);
  });

  it("returns null when no severity tier matches", () => {
    expect(pickSeverityQuip(weather())).toBeNull();
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
