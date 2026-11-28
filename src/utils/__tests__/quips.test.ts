import { describe, it, expect } from "vitest";
import {
  getSeverityScenario,
  pickSeverityQuip,
  SEVERE_QUIPS,
  isGreatDay,
  pickGreatDayQuip,
  GREAT_DAY_QUIPS,
  isAlmostGoodDay,
  pickAlmostGoodDayQuip,
  ALMOST_GOOD_DAY_QUIPS,
  pickStreakQuip,
  STREAK_QUIPS,
  pickStreakBrokenQuip,
  streakCulprit,
  STREAK_BROKEN_QUIPS,
  STREAK_BROKEN_SCENARIO_QUIPS,
  STREAK_BROKEN_ANY_QUIPS,
  windQuarter,
  WIND_DIRECTION_QUIPS,
  pickDeadCalmQuip,
  DEAD_CALM_QUIPS,
  pickDroughtQuip,
  pickDroughtOverQuip,
  pickTomorrowQuip,
  pickDayOfWeekGoodQuip,
  WEEKEND_GOOD_QUIPS,
  MONDAY_GOOD_QUIPS,
  pickQuip,
  QUIPS,
  APRIL_GOOD_QUIPS,
  WEDNESDAY_BAD_QUIPS,
  pickForecastSummary,
  FORECAST_SUMMARY,
  FORECAST_ONE_THURSDAY,
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

describe("pickStreakQuip", () => {
  it("returns null below the 2-day tier", () => {
    expect(pickStreakQuip(0)).toBeNull();
    expect(pickStreakQuip(1)).toBeNull();
  });

  it("returns a quip from the matching tier for 2, 3, 4, and 5", () => {
    expect(STREAK_QUIPS[2]).toContain(pickStreakQuip(2));
    expect(STREAK_QUIPS[3]).toContain(pickStreakQuip(3));
    expect(STREAK_QUIPS[4]).toContain(pickStreakQuip(4));
    expect(STREAK_QUIPS[5]).toContain(pickStreakQuip(5));
  });

  it("streaks longer than 5 reuse the 5-day tier", () => {
    expect(STREAK_QUIPS[5]).toContain(pickStreakQuip(6));
    expect(STREAK_QUIPS[5]).toContain(pickStreakQuip(30));
  });
});

describe("isAlmostGoodDay", () => {
  const minTemp = 13;

  it("true when temp is under a degree short of the minimum, wind/rain both pass", () => {
    expect(isAlmostGoodDay(12.3, minTemp, true, true)).toBe(true);
  });

  it("true right at the edge — just under a full degree short", () => {
    expect(isAlmostGoodDay(12.01, minTemp, true, true)).toBe(true);
  });

  it("false a full degree or more short of the minimum", () => {
    expect(isAlmostGoodDay(12, minTemp, true, true)).toBe(false);
    expect(isAlmostGoodDay(10, minTemp, true, true)).toBe(false);
  });

  it("false when temperature already meets the minimum", () => {
    expect(isAlmostGoodDay(13, minTemp, true, true)).toBe(false);
    expect(isAlmostGoodDay(15, minTemp, true, true)).toBe(false);
  });

  it("false when wind doesn't meet the good-day threshold", () => {
    expect(isAlmostGoodDay(12.5, minTemp, false, true)).toBe(false);
  });

  it("false when rain doesn't meet the good-day threshold", () => {
    expect(isAlmostGoodDay(12.5, minTemp, true, false)).toBe(false);
  });
});

describe("pickAlmostGoodDayQuip", () => {
  it("returns a quip from the almost-good-day list", () => {
    expect(ALMOST_GOOD_DAY_QUIPS).toContain(pickAlmostGoodDayQuip());
  });
});

describe("pickStreakBrokenQuip", () => {
  // Fill a template the same way the picker does, so pool membership can be checked.
  const filled = (lines: readonly string[], culprit: string, n: number) =>
    lines.map((l) => l.replace("{culprit}", culprit).replace("{n}", String(n)));

  it("returns null with no run to break, or when nothing actually failed", () => {
    expect(pickStreakBrokenQuip(0, false, false, false)).toBeNull();
    expect(pickStreakBrokenQuip(3, true, true, true)).toBeNull();
  });

  it("picks from the run's tier plus the matching scenario lines, templates filled", () => {
    for (let i = 0; i < 50; i++) {
      const q = pickStreakBrokenQuip(2, true, false, true)!; // wind only
      expect([
        ...filled(STREAK_BROKEN_QUIPS[2], "wind", 2),
        ...STREAK_BROKEN_SCENARIO_QUIPS.WIND_ONLY!,
        ...STREAK_BROKEN_ANY_QUIPS,
      ]).toContain(q);
      expect(q).not.toMatch(/[{}]/);
    }
  });

  it("runs of 5 or more share the last tier and use the real length", () => {
    for (let i = 0; i < 50; i++) {
      const q = pickStreakBrokenQuip(7, true, true, false)!; // rain only
      expect([
        ...filled(STREAK_BROKEN_QUIPS[5], "rain", 7),
        ...STREAK_BROKEN_SCENARIO_QUIPS.RAIN_ONLY!,
        ...STREAK_BROKEN_ANY_QUIPS,
      ]).toContain(q);
    }
  });
});

describe("streakCulprit", () => {
  it("names what failed", () => {
    expect(streakCulprit(true, false, true)).toBe("wind");
    expect(streakCulprit(false, true, true)).toBe("cold");
    expect(streakCulprit(true, false, false)).toBe("wind and rain");
    expect(streakCulprit(false, true, false)).toBe("rain and cold");
    expect(streakCulprit(false, false, false)).toBe("weather");
  });
});

describe("wind direction quips", () => {
  it("sorts directions into north, south or neither", () => {
    expect(windQuarter(0)).toBe("north");
    expect(windQuarter(330)).toBe("north");
    expect(windQuarter(45)).toBe("north");
    expect(windQuarter(180)).toBe("south");
    expect(windQuarter(210)).toBe("south");
    expect(windQuarter(90)).toBeNull();
    expect(windQuarter(270)).toBeNull();
    expect(windQuarter(null)).toBeNull();
  });

  it("only adds lines matching the direction to a strong-wind day", () => {
    for (let i = 0; i < 50; i++) {
      const q = pickSeverityQuip(weather({ windSpeed: 45, windDirection: 180 }))!;
      expect([...SEVERE_QUIPS.WIND_40, ...WIND_DIRECTION_QUIPS.south]).toContain(q);
    }
  });

  it("adds direction lines to a wind-only day but not to other scenarios", () => {
    for (let i = 0; i < 50; i++) {
      expect([...QUIPS.WIND_ONLY, ...WIND_DIRECTION_QUIPS.north]).toContain(pickQuip("WIND_ONLY", { windDirection: 0 }));
      expect(QUIPS.RAIN_ONLY).toContain(pickQuip("RAIN_ONLY", { windDirection: 0 }));
    }
  });
});

describe("dead calm", () => {
  it("fires under 5 km/h only", () => {
    expect(DEAD_CALM_QUIPS).toContain(pickDeadCalmQuip(4.9));
    expect(pickDeadCalmQuip(5)).toBeNull();
  });
});

describe("long bad runs", () => {
  it("needs a week or more, and fills in the count", () => {
    expect(pickDroughtQuip(6)).toBeNull();
    for (let i = 0; i < 30; i++) {
      const q = pickDroughtQuip(16)!;
      expect(q).not.toMatch(/[{}]/);
      expect(q.startsWith("A week")).toBe(false);
    }
  });

  it("the drought-over line needs 7+ bad days before it", () => {
    expect(pickDroughtOverQuip(6)).toBeNull();
    expect(pickDroughtOverQuip(9)).not.toMatch(/[{}]/);
  });
});

describe("tomorrow and day-of-week quips", () => {
  it("tomorrow's line only when tomorrow looks good", () => {
    expect(pickTomorrowQuip(false)).toBeNull();
    expect(pickTomorrowQuip(true)).toBeTruthy();
  });

  it("weekend and Monday lines, nothing midweek", () => {
    expect(WEEKEND_GOOD_QUIPS).toContain(pickDayOfWeekGoodQuip(6));
    expect(WEEKEND_GOOD_QUIPS).toContain(pickDayOfWeekGoodQuip(0));
    expect(MONDAY_GOOD_QUIPS).toContain(pickDayOfWeekGoodQuip(1));
    expect(pickDayOfWeekGoodQuip(3)).toBeNull();
  });
});

describe("date-dependent lines", () => {
  it("April and Wednesday lines only join the right pools", () => {
    for (let i = 0; i < 50; i++) {
      expect([...QUIPS.GOOD, ...APRIL_GOOD_QUIPS]).toContain(pickQuip("GOOD", { month: 4 }));
      expect(QUIPS.GOOD).toContain(pickQuip("GOOD", { month: 5, dayOfWeek: 3 }));
      expect([...QUIPS.RAIN_ONLY, ...WEDNESDAY_BAD_QUIPS]).toContain(pickQuip("RAIN_ONLY", { dayOfWeek: 3 }));
      expect(QUIPS.RAIN_ONLY).toContain(pickQuip("RAIN_ONLY", { month: 4, dayOfWeek: 2 }));
    }
  });

  it("the Thursday forecast line only when Thursday is the one good day", () => {
    for (let i = 0; i < 50; i++) {
      expect([...FORECAST_SUMMARY.one, ...FORECAST_ONE_THURSDAY]).toContain(pickForecastSummary(1, 4));
      expect(FORECAST_SUMMARY.one).toContain(pickForecastSummary(1, 5));
      expect(FORECAST_SUMMARY.few).toContain(pickForecastSummary(2, 4));
    }
  });
});
