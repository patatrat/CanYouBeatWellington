import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import {
  parseWellingtonAlert,
  polygonContains,
  sortWarnings,
  warningForDay,
  warningsByDay,
  formatNZTime,
  type WeatherWarning,
} from "../weather-warnings";

// Real MetService CAP alerts from 25 Oct 2026 (signatures stripped).
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");
const WELLINGTON_WIND = fixture("cap-wellington-wind.xml");
const OTAGO_WIND = fixture("cap-otago-wind.xml");
const BEFORE_EXPIRY = new Date("2026-10-26T12:00:00+13:00");

describe("parseWellingtonAlert", () => {
  it("parses a live warning covering Wellington", () => {
    const warning = parseWellingtonAlert(WELLINGTON_WIND, BEFORE_EXPIRY);
    expect(warning).toMatchObject({
      headline: "Strong Wind Warning - Orange",
      colour: "#FF8918",
      colourName: "Orange",
      onset: "2026-10-26T18:00:00+13:00",
      expires: "2026-10-27T10:00:00+13:00",
      web: "https://metservice.com/warnings/home",
    });
    expect(warning?.description).toMatch(/^Severe gale northwest winds gusting 120 km\/h/);
    expect(warning?.instruction).toMatch(/^Action: Prepare your property/);
  });

  it("reads the identifiers of the alerts a reissue replaces", () => {
    expect(parseWellingtonAlert(WELLINGTON_WIND, BEFORE_EXPIRY)?.references).toEqual([]);
    const reissue = WELLINGTON_WIND.replace(
      "<scope>Public</scope>",
      "<scope>Public</scope><references>https://www.metservice.com,old.1,2026-10-24T20:24:28+13:00 https://www.metservice.com,old.2,2026-10-24T21:00:00+13:00</references>",
    );
    expect(parseWellingtonAlert(reissue, BEFORE_EXPIRY)?.references).toEqual(["old.1", "old.2"]);
  });

  it("ignores alerts for other regions", () => {
    expect(parseWellingtonAlert(OTAGO_WIND, BEFORE_EXPIRY)).toBeNull();
  });

  it("drops an alert once it has expired", () => {
    expect(parseWellingtonAlert(WELLINGTON_WIND, new Date("2026-10-27T10:00:00+13:00"))).toBeNull();
  });

  it("drops cancellations and non-Actual alerts", () => {
    expect(parseWellingtonAlert(WELLINGTON_WIND.replace("<msgType>Alert", "<msgType>Cancel"), BEFORE_EXPIRY)).toBeNull();
    expect(parseWellingtonAlert(WELLINGTON_WIND.replace("<status>Actual", "<status>Exercise"), BEFORE_EXPIRY)).toBeNull();
  });
});

describe("polygonContains", () => {
  const square = "-41,174 -41,175 -42,175 -42,174 -41,174";
  it("finds points inside and outside", () => {
    expect(polygonContains(square, -41.5, 174.5)).toBe(true);
    expect(polygonContains(square, -40.5, 174.5)).toBe(false);
    expect(polygonContains(square, -41.5, 175.5)).toBe(false);
  });
});

describe("sortWarnings", () => {
  const w = (colourName: string, onset: string) => ({ colourName, onset, expires: onset }) as WeatherWarning;
  it("puts the most severe first, then the soonest", () => {
    const sorted = sortWarnings([
      w("Yellow", "2026-10-26T06:00:00+13:00"),
      w("Orange", "2026-10-27T06:00:00+13:00"),
      w("Red", "2026-10-28T06:00:00+13:00"),
      w("Orange", "2026-10-26T18:00:00+13:00"),
    ]);
    expect(sorted.map((x) => `${x.colourName} ${x.onset?.slice(8, 13)}`)).toEqual([
      "Red 28T06",
      "Orange 26T18",
      "Orange 27T06",
      "Yellow 26T06",
    ]);
  });
});

describe("warningForDay", () => {
  const warning = (colourName: string, onset: string | null, expires: string) =>
    ({ colourName, onset, expires }) as WeatherWarning;
  // 6pm Mon 26 Oct – 10am Tue 27 Oct NZDT, the real Wellington wind warning.
  const wind = warning("Orange", "2026-10-26T18:00:00+13:00", "2026-10-27T10:00:00+13:00");

  it("covers every NZ day the warning touches", () => {
    expect(warningForDay("2026-10-25", [wind])).toBeNull();
    expect(warningForDay("2026-10-26", [wind])).toBe(wind);
    expect(warningForDay("2026-10-27", [wind])).toBe(wind);
    expect(warningForDay("2026-10-28", [wind])).toBeNull();
  });

  it("doesn't spill into the next day when it ends at midnight", () => {
    const toMidnight = warning("Yellow", "2026-10-26T06:00:00+13:00", "2026-10-27T00:00:00+13:00");
    expect(warningForDay("2026-10-27", [toMidnight])).toBeNull();
  });

  it("treats a warning without an onset as already in force", () => {
    const now = warning("Yellow", null, "2026-10-27T10:00:00+13:00");
    expect(warningForDay("2026-10-26", [now])).toBe(now);
  });

  it("picks the first (most severe) of overlapping warnings", () => {
    const red = warning("Red", "2026-10-27T00:00:00+13:00", "2026-10-27T06:00:00+13:00");
    expect(warningForDay("2026-10-27", sortWarnings([wind, red]))).toBe(red);
  });
});

describe("warningsByDay", () => {
  const warning = (colourName: string, onset: string | null, expires: string, headline = colourName) =>
    ({ colourName, colour: colourName, headline, onset, expires }) as WeatherWarning;

  it("maps every NZ day a warning touches to it", () => {
    const wind = warning("Orange", "2026-10-26T18:00:00+13:00", "2026-10-27T10:00:00+13:00");
    expect(Object.keys(warningsByDay([wind]))).toEqual(["2026-10-26", "2026-10-27"]);
  });

  it("keeps the most severe warning on days that overlap", () => {
    const days = warningsByDay([
      warning("Yellow", "2026-10-25T06:00:00+13:00", "2026-10-28T06:00:00+13:00"),
      warning("Red", "2026-10-26T12:00:00+13:00", "2026-10-26T20:00:00+13:00"),
    ]);
    expect(Object.fromEntries(Object.entries(days).map(([d, w]) => [d, w.colourName]))).toEqual({
      "2026-10-25": "Yellow",
      "2026-10-26": "Red",
      "2026-10-27": "Yellow",
      "2026-10-28": "Yellow",
    });
  });

  it("crosses a month boundary", () => {
    const w = warning("Orange", "2026-10-31T20:00:00+13:00", "2026-11-01T08:00:00+13:00");
    expect(Object.keys(warningsByDay([w]))).toEqual(["2026-10-31", "2026-11-01"]);
  });
});

describe("formatNZTime", () => {
  it("formats in NZ time regardless of the server's timezone", () => {
    expect(formatNZTime("2026-10-26T18:00:00+13:00")).toBe("6pm Mon 26 Oct");
    expect(formatNZTime("2026-10-26T21:30:00Z")).toBe("10:30am Tue 27 Oct");
  });
});
