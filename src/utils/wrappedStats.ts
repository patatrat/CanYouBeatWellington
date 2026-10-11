// "Can You Beat Wellington Wrapped" — a calendar-year review computed live
// from stored history, same "derive at runtime" approach as
// weatherFunFacts.ts. Pure (no DB import) so every stat is unit-testable;
// the page at /wrapped/[year] fetches the rows and calls computeWrapped().

import { getSeasonLabel, getThresholds } from "./rulesStorage";
import {
  pickPrimarySpecialDate,
  resolveVerdict,
  type ActiveSpecialDate,
} from "@/lib/special-dates-logic";
import type { DailyWeatherRecord } from "@/types/db";

export interface WrappedDay {
  date: string;
  temperature: number;
  windSpeed: number;
  rain: number;
  snowfall: number | null;
  agree: number;
  disagree: number;
  // Which of the three good-day criteria this day met.
  tempMet: boolean;
  windMet: boolean;
  rainMet: boolean;
  weatherGood: boolean;
  good: boolean;
  specialTitle: string | null;
  override: boolean | null;
}

export interface Streak {
  length: number;
  start: string;
  end: string;
}

export interface VoteGroup {
  agree: number;
  disagree: number;
  // Share of votes on these days that disagreed with the verdict, 0–1.
  // Null when nobody voted on any day in the group.
  disagreeRate: number | null;
}

// Votes grouped by the verdict's reasoning, e.g. "ruled bad only for being
// too cold". Lets the page show which rules people push back on.
export type VoteReason = "good" | "cold" | "wind" | "rain";

export interface ReasonVotes extends VoteGroup {
  reason: VoteReason;
  days: number;
}

export interface VotedDay {
  date: string;
  agree: number;
  disagree: number;
  good: boolean;
  temperature: number;
  windSpeed: number;
  rain: number;
}

// Vote samples are small (most days get a handful), so per-day and
// per-group insights need a floor before they mean anything. A group
// below MIN_GROUP_VOTES is left out rather than shown as a noisy 0% or 100%.
export const MIN_DAY_VOTES = 5;
export const MIN_GROUP_VOTES = 10;

export interface SeasonStat {
  label: string;
  good: number;
  total: number;
  pct: number;
}

export interface WindBin {
  label: string;
  min: number;
  max: number | null;
  count: number;
}

export interface WrappedStats {
  year: number;
  // Through which date the review runs: Dec 31 for a finished year,
  // today for the current one.
  throughDate: string;
  isPartialYear: boolean;
  daysElapsed: number;
  recordedDays: number;
  missingDates: string[];
  goodDays: number;
  badDays: number;
  goodPct: number;
  seasons: SeasonStat[];
  votes: {
    agree: number;
    disagree: number;
    firstVoteDate: string | null;
    onGoodDays: VoteGroup;
    onBadDays: VoteGroup;
    // Only groups with at least MIN_GROUP_VOTES votes, highest disagreement first.
    byReason: ReasonVotes[];
    // Days with at least MIN_DAY_VOTES votes.
    mostContested: VotedDay | null;
    mostUnanimous: VotedDay | null;
    busiest: VotedDay | null;
  };
  rainDays: number;
  rainPct: number;
  rainiestDay: { date: string; rain: number } | null;
  // `temperature` is each day's maximum, so the coldest day is the one
  // with the lowest high.
  hottestDay: { date: string; temperature: number } | null;
  coldestDay: { date: string; temperature: number } | null;
  // Average daytime wind, same measure the good-day rule uses.
  windiestDay: { date: string; windSpeed: number } | null;
  stillestDay: { date: string; windSpeed: number } | null;
  snowDays: { date: string; snowfall: number }[];
  // The year's mean temperature (daily high), daytime wind and daytime rain.
  averages: { temperature: number; windSpeed: number; rain: number } | null;
  // The day closest to all three averages at once. See mostAverage().
  mostAverageDay: { date: string; temperature: number; windSpeed: number; rain: number; good: boolean } | null;
  longestGoodStreak: Streak | null;
  longestBadStreak: Streak | null;
  // Consecutive days with any daytime rain (> 0mm, same bar as rainDays).
  longestRainStreak: Streak | null;
  windBins: WindBin[];
}

// Rows where temperature, wind and rain are all exactly zero are
// placeholders, not weather: until 2026-10-11 the daily cron stored
// Open-Meteo's explicit nulls as zeros (see buildDailyRecords in
// weather.ts). A genuine Wellington day is never 0°C with dead calm, so
// these are treated as missing data rather than counted as bad days.
export const isPlaceholderRecord = (r: Pick<DailyWeatherRecord, "temperature" | "wind_speed" | "rain">): boolean =>
  r.temperature === 0 && r.wind_speed === 0 && r.rain === 0;

export const WIND_BINS: Omit<WindBin, "count">[] = [
  { label: "0–10", min: 0, max: 10 },
  { label: "10–20", min: 10, max: 20 },
  { label: "20–30", min: 20, max: 30 },
  { label: "30–40", min: 30, max: 40 },
  { label: "40+", min: 40, max: null },
];

const addDays = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const daysInclusive = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

const voteGroup = (days: WrappedDay[]): VoteGroup => {
  const agree = days.reduce((s, d) => s + d.agree, 0);
  const disagree = days.reduce((s, d) => s + d.disagree, 0);
  const total = agree + disagree;
  return { agree, disagree, disagreeRate: total ? disagree / total : null };
};

// Longest run of consecutive calendar days matching `predicate`. A missing
// day breaks a run — a streak can't be claimed across a gap in the data.
const longestStreak = (days: WrappedDay[], predicate: (d: WrappedDay) => boolean): Streak | null => {
  let best: Streak | null = null;
  let current: Streak | null = null;
  let prevDate: string | null = null;
  for (const day of days) {
    const contiguous = prevDate !== null && addDays(prevDate, 1) === day.date;
    if (predicate(day)) {
      const next: Streak = current !== null && contiguous
        ? { start: current.start, length: current.length + 1, end: day.date }
        : { length: 1, start: day.date, end: day.date };
      current = next;
      if (best === null || next.length > best.length) best = next;
    } else {
      current = null;
    }
    prevDate = day.date;
  }
  return best;
};

const maxBy = <T>(items: T[], key: (t: T) => number): T | null =>
  items.reduce<T | null>((best, item) => (best === null || key(item) > key(best) ? item : best), null);

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const stdDev = (xs: number[], m: number) => Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));

// The day nearest the year's mean on temperature, wind and rain together.
// Each measure's distance is divided by that measure's standard deviation,
// so a degree of temperature and a millimetre of rain aren't treated as the
// same size: rain swings far more day to day, so it counts for less per
// millimetre. Ties go to the earliest day.
const mostAverage = (days: WrappedDay[]) => {
  if (days.length === 0) return { averages: null, day: null };
  const measures = [
    (d: WrappedDay) => d.temperature,
    (d: WrappedDay) => d.windSpeed,
    (d: WrappedDay) => d.rain,
  ];
  const stats = measures.map((get) => {
    const values = days.map(get);
    const m = mean(values);
    return { get, mean: m, sd: stdDev(values, m) || 1 };
  });
  const distance = (d: WrappedDay) =>
    Math.sqrt(stats.reduce((sum, { get, mean: m, sd }) => sum + ((get(d) - m) / sd) ** 2, 0));
  return {
    averages: { temperature: stats[0].mean, windSpeed: stats[1].mean, rain: stats[2].mean },
    day: minBy(days, distance),
  };
};

const minBy = <T>(items: T[], key: (t: T) => number): T | null => maxBy(items, (t) => -key(t));

const toVotedDay = (d: WrappedDay): VotedDay => ({
  date: d.date,
  agree: d.agree,
  disagree: d.disagree,
  good: d.good,
  temperature: d.temperature,
  windSpeed: d.windSpeed,
  rain: d.rain,
});

// Which group a day's votes count towards. Good days form one baseline
// group. A bad day counts towards every rule it failed ("cold" only when
// it was calm and dry, i.e. temperature was the sole reason), so a windy
// wet day counts under both "wind" and "rain". Days whose verdict came from
// a special-date override aren't about the weather rules, so they're
// excluded from the bad-day reasons.
const reasonsFor = (d: WrappedDay): VoteReason[] => {
  if (d.good) return ["good"];
  if (d.weatherGood) return [];
  const reasons: VoteReason[] = [];
  if (!d.tempMet && d.windMet && d.rainMet) reasons.push("cold");
  if (!d.windMet) reasons.push("wind");
  if (!d.rainMet) reasons.push("rain");
  return reasons;
};

const voteInsights = (days: WrappedDay[]) => {
  const byReason = (["good", "cold", "wind", "rain"] as VoteReason[])
    .map((reason) => {
      const group = days.filter((d) => reasonsFor(d).includes(reason));
      return { reason, days: group.length, ...voteGroup(group) };
    })
    .filter((g) => g.agree + g.disagree >= MIN_GROUP_VOTES)
    .sort((a, b) => (b.disagreeRate ?? 0) - (a.disagreeRate ?? 0));

  const total = (d: WrappedDay) => d.agree + d.disagree;
  const share = (d: WrappedDay) => d.disagree / total(d);
  const sampled = days.filter((d) => total(d) >= MIN_DAY_VOTES);

  // Highest share of disagreement, ties broken by more votes.
  const contested = sampled
    .filter((d) => d.disagree > 0)
    .sort((a, b) => share(b) - share(a) || total(b) - total(a))[0];
  // Lowest share of disagreement, ties broken by more votes.
  const unanimous = [...sampled].sort((a, b) => share(a) - share(b) || total(b) - total(a))[0];
  const busiest = maxBy(days.filter((d) => total(d) > 0), total);

  return {
    byReason,
    mostContested: contested ? toVotedDay(contested) : null,
    mostUnanimous: unanimous ? toVotedDay(unanimous) : null,
    busiest: busiest ? toVotedDay(busiest) : null,
  };
};

export function buildWrappedDays(
  records: DailyWeatherRecord[],
  specialDates: ActiveSpecialDate[],
): WrappedDay[] {
  return [...records]
    .filter((r) => !isPlaceholderRecord(r))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((r) => {
      // Same three checks as isGoodWeatherDay(), kept separately so vote
      // insights can say *which* rule ruled a day out.
      const { minTemp, maxWind, maxRain } = getThresholds(r.date);
      const tempMet = r.temperature >= minTemp;
      const windMet = r.wind_speed < maxWind;
      const rainMet = r.rain <= maxRain;
      const weatherGood = tempMet && windMet && rainMet;
      const special = pickPrimarySpecialDate(
        specialDates.filter((d) => d.start_date <= r.date && r.date <= d.end_date),
      );
      const override = special?.verdict_override ?? null;
      return {
        date: r.date,
        temperature: r.temperature,
        windSpeed: r.wind_speed,
        rain: r.rain,
        snowfall: r.snowfall,
        agree: r.agree_count,
        disagree: r.disagree_count,
        tempMet,
        windMet,
        rainMet,
        weatherGood,
        good: resolveVerdict(weatherGood, override),
        specialTitle: special?.title ?? null,
        override,
      };
    });
}

// `today` is the NZ calendar date (YYYY-MM-DD); it caps the review for the
// current year so "so far" stats never count future days as missing.
export function computeWrapped(
  year: number,
  records: DailyWeatherRecord[],
  specialDates: ActiveSpecialDate[],
  today: string,
): WrappedStats {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const throughDate = today < yearEnd ? today : yearEnd;
  const isPartialYear = throughDate < yearEnd;

  const days = buildWrappedDays(
    records.filter((r) => r.date >= yearStart && r.date <= throughDate),
    specialDates,
  );

  const daysElapsed = Math.max(0, daysInclusive(yearStart, throughDate));
  const recorded = new Set(days.map((d) => d.date));
  const missingDates: string[] = [];
  for (let i = 0; i < daysElapsed; i++) {
    const date = addDays(yearStart, i);
    if (!recorded.has(date)) missingDates.push(date);
  }

  const goodDays = days.filter((d) => d.good).length;
  const pct = (n: number) => (days.length ? (n / days.length) * 100 : 0);

  const seasonAcc = new Map<string, { good: number; total: number }>();
  for (const d of days) {
    const label = getSeasonLabel(d.date);
    const acc = seasonAcc.get(label) ?? { good: 0, total: 0 };
    acc.total++;
    if (d.good) acc.good++;
    seasonAcc.set(label, acc);
  }
  const seasons = [...seasonAcc.entries()]
    .map(([label, { good, total }]) => ({ label, good, total, pct: (good / total) * 100 }))
    // By share of good days, not raw count: seasons differ in length (Spring 1
    // is one month, Summer three), so a count would just reward long seasons.
    .sort((a, b) => b.pct - a.pct || b.good - a.good);

  const voted = days.filter((d) => d.agree + d.disagree > 0);
  const rainy = days.filter((d) => d.rain > 0);
  const rainiest = maxBy(rainy, (d) => d.rain);
  const hottest = maxBy(days, (d) => d.temperature);
  const coldest = minBy(days, (d) => d.temperature);
  const windiest = maxBy(days, (d) => d.windSpeed);
  const stillest = minBy(days, (d) => d.windSpeed);
  const average = mostAverage(days);

  return {
    year,
    throughDate,
    isPartialYear,
    daysElapsed,
    recordedDays: days.length,
    missingDates,
    goodDays,
    badDays: days.length - goodDays,
    goodPct: pct(goodDays),
    seasons,
    votes: {
      agree: voted.reduce((s, d) => s + d.agree, 0),
      disagree: voted.reduce((s, d) => s + d.disagree, 0),
      firstVoteDate: voted[0]?.date ?? null,
      onGoodDays: voteGroup(days.filter((d) => d.good)),
      onBadDays: voteGroup(days.filter((d) => !d.good)),
      ...voteInsights(days),
    },
    rainDays: rainy.length,
    rainPct: pct(rainy.length),
    rainiestDay: rainiest ? { date: rainiest.date, rain: rainiest.rain } : null,
    hottestDay: hottest ? { date: hottest.date, temperature: hottest.temperature } : null,
    coldestDay: coldest ? { date: coldest.date, temperature: coldest.temperature } : null,
    windiestDay: windiest ? { date: windiest.date, windSpeed: windiest.windSpeed } : null,
    stillestDay: stillest ? { date: stillest.date, windSpeed: stillest.windSpeed } : null,
    snowDays: days
      .filter((d) => (d.snowfall ?? 0) > 0)
      .map((d) => ({ date: d.date, snowfall: d.snowfall ?? 0 })),
    averages: average.averages,
    mostAverageDay: average.day
      ? {
          date: average.day.date,
          temperature: average.day.temperature,
          windSpeed: average.day.windSpeed,
          rain: average.day.rain,
          good: average.day.good,
        }
      : null,
    longestGoodStreak: longestStreak(days, (d) => d.good),
    longestBadStreak: longestStreak(days, (d) => !d.good),
    longestRainStreak: longestStreak(days, (d) => d.rain > 0),
    windBins: WIND_BINS.map((bin) => ({
      ...bin,
      count: days.filter((d) => d.windSpeed >= bin.min && (bin.max === null || d.windSpeed < bin.max)).length,
    })),
  };
}
