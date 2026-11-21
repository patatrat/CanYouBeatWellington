// A GitHub-style year grid: one square per day, one column per week
// (Monday first). Weather only — each day is judged on the season's
// temperature/wind/rain rules with no special-date override, so the grid
// shows what the weather did, not what the site's verdict was. Pure, so the
// History page and Wrapped share it and it can be unit tested.

import { getThresholds } from "./rulesStorage";
import { isPlaceholderRecord } from "./wrappedStats";
import type { DailyWeatherRecord } from "@/types/db";

export interface YearGridChecks {
  temp: boolean;
  wind: boolean;
  rain: boolean;
}

export interface YearGridCell {
  date: string;
  col: number;
  row: number; // 0 = Monday
  // "empty": a past day with no usable record, or a day still to come.
  status: "good" | "bad" | "empty";
  checks: YearGridChecks | null;
  // How many of the three checks failed, 0–3 (0 for good/empty days).
  failed: number;
  warning: { colour: string; colourName: string } | null;
}

export interface YearGridStats {
  goodDays: number;
  recordedDays: number;
  longestRun: { length: number; start: string; end: string } | null;
  bestMonth: { month: number; good: number; total: number } | null;
  warningDays: number;
  failedAllThree: number;
}

export interface YearGrid {
  year: number;
  weeks: number;
  cells: YearGridCell[];
  // Week column where each month starts, for the labels along the top.
  monthStarts: { month: number; col: number }[];
  stats: YearGridStats;
}

const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function buildYearGrid(
  year: number,
  records: DailyWeatherRecord[],
  warningDays: Record<string, { colour: string; colourName: string }>,
  today: string,
): YearGrid {
  // All-zero rows are old placeholders, not real days (see isPlaceholderRecord).
  const byDate = new Map(records.filter((r) => !isPlaceholderRecord(r)).map((r) => [r.date, r]));
  const jan1 = Date.UTC(year, 0, 1);
  const offset = (new Date(jan1).getUTCDay() + 6) % 7; // Monday = 0
  const daysInYear = (Date.UTC(year + 1, 0, 1) - jan1) / DAY_MS;

  const cells: YearGridCell[] = [];
  const monthStarts: YearGrid["monthStarts"] = [];
  const monthGood = Array(12).fill(0);
  const monthTotal = Array(12).fill(0);
  let goodDays = 0;
  let recordedDays = 0;
  let warningCount = 0;
  let failedAllThree = 0;
  let run = 0;
  let longestRun: YearGridStats["longestRun"] = null;

  for (let i = 0; i < daysInYear; i++) {
    const d = new Date(jan1 + i * DAY_MS);
    const date = iso(d);
    const month = d.getUTCMonth();
    const col = Math.floor((i + offset) / 7);
    if (d.getUTCDate() === 1) monthStarts.push({ month, col });

    const record = date <= today ? byDate.get(date) : undefined;
    const warning = date <= today && warningDays[date] ? { colour: warningDays[date].colour, colourName: warningDays[date].colourName } : null;
    if (warning) warningCount++;

    if (!record) {
      // A gap breaks a run, same as weatherFunFacts' streaks.
      run = 0;
      cells.push({ date, col, row: (i + offset) % 7, status: "empty", checks: null, failed: 0, warning });
      continue;
    }

    const { minTemp, maxWind, maxRain } = getThresholds(date);
    const checks = {
      temp: record.temperature >= minTemp,
      wind: record.wind_speed < maxWind,
      rain: record.rain <= maxRain,
    };
    const failed = [checks.temp, checks.wind, checks.rain].filter((ok) => !ok).length;
    const good = failed === 0;

    recordedDays++;
    monthTotal[month]++;
    if (good) {
      goodDays++;
      monthGood[month]++;
      run++;
      if (!longestRun || run > longestRun.length) {
        longestRun = { length: run, start: iso(new Date(d.getTime() - (run - 1) * DAY_MS)), end: date };
      }
    } else {
      run = 0;
    }
    if (failed === 3) failedAllThree++;

    cells.push({ date, col, row: (i + offset) % 7, status: good ? "good" : "bad", checks, failed, warning });
  }

  // Best month by share of good days, so a part-recorded month competes
  // fairly. Ties go to the earlier month.
  let bestMonth: YearGridStats["bestMonth"] = null;
  for (let m = 0; m < 12; m++) {
    if (monthTotal[m] === 0) continue;
    if (!bestMonth || monthGood[m] / monthTotal[m] > bestMonth.good / bestMonth.total) {
      bestMonth = { month: m, good: monthGood[m], total: monthTotal[m] };
    }
  }

  return {
    year,
    weeks: Math.ceil((daysInYear + offset) / 7),
    cells,
    monthStarts,
    stats: { goodDays, recordedDays, longestRun, bestMonth, warningDays: warningCount, failedAllThree },
  };
}
