// Fun facts for the History page, computed from the full weather history.
// Pure (no DB import) so every fact is unit-testable. All of them are
// computed on the server and the browser picks one at random, because the
// page itself is cached for an hour.
//
// Each fact carries a scope label so a single rotating card can mix
// all-time records, this year, this date in past years and the current run.
// The year-by-year deep dive lives in Wrapped (wrappedStats.ts).

import { format, getDay, parseISO, subDays } from 'date-fns';
import { getSeasonLabel, isGoodWeatherDay } from './rulesStorage';
import type { DailyWeatherRecord } from '@/types/db';

export interface FunFact {
  scope: string;
  text: string;
}

type Day = Pick<DailyWeatherRecord, 'date' | 'temperature' | 'wind_speed' | 'rain' | 'agree_count' | 'disagree_count'>;

// The rule-based verdict only. Special-date overrides (a Hurricanes win
// forcing a good day) are deliberately left out: these facts are about the
// weather.
const isGood = (d: Day) => isGoodWeatherDay({ temperature: d.temperature, windSpeed: d.wind_speed, rain: d.rain }, d.date);

// Same rule as Wrapped: all-zero rows were placeholders the old cron wrote
// for missing data, not real weather.
const isPlaceholder = (d: Day) => d.temperature === 0 && d.wind_speed === 0 && d.rain === 0;

const pct = (n: number, of: number) => `${Math.round((n / of) * 100)}%`;
const rate = (share: number) => `${Math.round(share * 100)}%`;
const longDate = (date: string) => format(parseISO(date), 'd MMMM yyyy');
const shortDate = (date: string) => format(parseISO(date), 'd MMMM');
const one = (n: number) => n.toFixed(1);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const maxBy = <T,>(items: T[], value: (item: T) => number) =>
  items.reduce((best, item) => (value(item) > value(best) ? item : best));
const minBy = <T,>(items: T[], value: (item: T) => number) =>
  items.reduce((best, item) => (value(item) < value(best) ? item : best));

const nextDate = (date: string) => format(subDays(parseISO(date), -1), 'yyyy-MM-dd');

// Longest run of consecutive dates matching predicate. A missing day breaks
// the run, so a streak is never claimed across a gap in the data.
interface Run {
  start: string;
  end: string;
  length: number;
}

const longestRun = (days: Day[], predicate: (d: Day) => boolean): Run | null => {
  let best: Run | null = null;
  let run: Run | null = null;
  for (const d of days) {
    if (!predicate(d)) {
      run = null;
      continue;
    }
    const extends_: boolean = run !== null && nextDate(run.end) === d.date;
    const current: Run = run !== null && extends_
      ? { start: run.start, end: d.date, length: run.length + 1 }
      : { start: d.date, end: d.date, length: 1 };
    run = current;
    if (best === null || current.length > best.length) best = current;
  }
  return best;
};

// history may arrive in any order; today is the NZ date (YYYY-MM-DD). Today
// itself is left out of every fact, since its record is still partly forecast.
const prepare = (history: DailyWeatherRecord[], today: string): Day[] | null => {
  const days: Day[] = history
    .filter((d) => d.date < today && !isPlaceholder(d))
    .sort((a, b) => a.date.localeCompare(b.date));
  return days.length < 30 ? null : days;
};

const seasonShares = (days: Day[]) => {
  const bySeason = new Map<string, { total: number; good: number }>();
  for (const d of days) {
    const label = getSeasonLabel(d.date);
    const s = bySeason.get(label) ?? { total: 0, good: 0 };
    s.total += 1;
    if (isGood(d)) s.good += 1;
    bySeason.set(label, s);
  }
  return bySeason;
};

const daysBetween = (from: string, to: string) =>
  Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000);

export const calculateFunFacts = (history: DailyWeatherRecord[], today: string): FunFact[] => {
  const days = prepare(history, today);
  if (!days) return [];

  const facts: FunFact[] = [];
  const allTime = (text: string) => facts.push({ scope: 'All time', text });
  const firstYear = days[0].date.slice(0, 4);
  const good = days.filter(isGood);

  // Good days overall and by season
  allTime(`There have been ${good.length.toLocaleString('en-NZ')} can't-beat-Wellington days since ${firstYear}.`);

  const bySeason = seasonShares(days);
  const seasons = [...bySeason.entries()].filter(([, s]) => s.total >= 30);
  if (seasons.length >= 2) {
    const [bestName, best] = maxBy(seasons, ([, s]) => s.good / s.total);
    allTime(`${bestName} is the best season for good days, delivering one ${pct(best.good, best.total)} of the time.`);
  }
  const shitsville = bySeason.get('Shitsville');
  if (shitsville && shitsville.total >= 30) {
    const rest = { total: days.length - shitsville.total, good: good.length - shitsville.good };
    allTime(`Shitsville (October and November) delivers a good day ${pct(shitsville.good, shitsville.total)} of the time. The rest of the year manages ${pct(rest.good, rest.total)}.`);
  }

  // Records
  const hottest = maxBy(days, (d) => d.temperature);
  const coldest = minBy(days, (d) => d.temperature);
  const windiest = maxBy(days, (d) => d.wind_speed);
  const wettest = maxBy(days, (d) => d.rain);
  allTime(`The hottest day on record reached ${one(hottest.temperature)}°C, on ${longDate(hottest.date)}.`);
  allTime(`The coldest day on record only got to ${one(coldest.temperature)}°C, on ${longDate(coldest.date)}.`);
  allTime(`The windiest day on record hit ${Math.round(windiest.wind_speed)} km/h, on ${longDate(windiest.date)}.`);
  if (wettest.rain > 0) allTime(`The wettest day on record dropped ${one(wettest.rain)}mm of rain in daylight hours, on ${longDate(wettest.date)}.`);

  // Rain and wind
  allTime(`It rains during the day on ${pct(days.filter((d) => d.rain > 0.1).length, days.length)} of days.`);
  const calm = days.filter((d) => d.wind_speed < 10).length;
  allTime(`Properly calm days, with wind under 10 km/h, make up just ${pct(calm, days.length)} of the record.`);
  const gales = days.filter((d) => d.wind_speed > 50).length;
  if (gales > 0) allTime(`Winds top 50 km/h on ${pct(gales, days.length)} of days. That's about ${Math.round((gales / days.length) * 365)} days a year.`);

  const avg = (ds: Day[]) => ds.reduce((sum, d) => sum + d.temperature, 0) / ds.length;
  const windy = days.filter((d) => d.wind_speed > 30);
  const still = days.filter((d) => d.wind_speed <= 15);
  // Only worth saying when the gap is noticeable.
  if (windy.length && still.length && Math.abs(avg(still) - avg(windy)) >= 0.5) {
    const diff = avg(still) - avg(windy);
    allTime(`Windy days (over 30 km/h) are on average ${one(Math.abs(diff))}°C ${diff > 0 ? 'colder' : 'warmer'} than still days.`);
  }

  // Streaks and best month
  const goodRun = longestRun(days, isGood);
  if (goodRun && goodRun.length > 1) {
    allTime(`The longest run of good days was ${goodRun.length} in a row, from ${longDate(goodRun.start)}.`);
  }

  const months = new Map<string, number>();
  for (const d of good) months.set(d.date.slice(0, 7), (months.get(d.date.slice(0, 7)) ?? 0) + 1);
  if (months.size) {
    const [bestMonth, count] = maxBy([...months.entries()], ([, n]) => n);
    allTime(`The best month on record was ${format(parseISO(`${bestMonth}-01`), 'MMMM yyyy')}, with ${count} good days.`);
  }

  // Weekends
  const weekend = days.filter((d) => [0, 6].includes(getDay(parseISO(d.date))));
  const weekdays = days.filter((d) => ![0, 6].includes(getDay(parseISO(d.date))));
  const weekendRate = weekend.filter(isGood).length / weekend.length;
  const weekdayRate = weekdays.filter(isGood).length / weekdays.length;
  allTime(
    Math.abs(weekendRate - weekdayRate) < 0.01
      ? `The weather doesn't care what day it is: weekends and weekdays get good days at the same rate.`
      : `Weekends get a good day ${rate(weekendRate)} of the time, weekdays ${rate(weekdayRate)}.`,
  );

  // Votes
  const agree = days.reduce((sum, d) => sum + d.agree_count, 0);
  const disagree = days.reduce((sum, d) => sum + d.disagree_count, 0);
  if (agree + disagree >= 20) {
    allTime(`Visitors have cast ${(agree + disagree).toLocaleString('en-NZ')} votes, and agreed with the verdict ${pct(agree, agree + disagree)} of the time.`);
  }

  // This year so far, against the same stretch of earlier years
  const year = today.slice(0, 4);
  const thisYear = days.filter((d) => d.date.startsWith(year));
  if (thisYear.length >= 14) {
    const scope = `${year} so far`;
    const yearGood = thisYear.filter(isGood).length;
    const cutoff = today.slice(5);
    const pastShares = [...new Set(days.map((d) => d.date.slice(0, 4)))]
      .filter((y) => y < year)
      .map((y) => days.filter((d) => d.date.startsWith(y) && d.date.slice(5) < cutoff))
      .filter((ds) => ds.length >= thisYear.length * 0.9)
      .map((ds) => ds.filter(isGood).length / ds.length);
    const avgShare = pastShares.length ? pastShares.reduce((a, b) => a + b, 0) / pastShares.length : null;
    const share = yearGood / thisYear.length;
    const comparison = avgShare === null
      ? ''
      : Math.abs(share - avgShare) < 0.01
        ? ' Right on average.'
        : ` ${share > avgShare ? 'Better' : 'Worse'} than the ${rate(avgShare)} a typical year manages by now.`;
    facts.push({ scope, text: `${plural(yearGood, 'good day')} out of ${thisYear.length} (${pct(yearGood, thisYear.length)}).${comparison}` });
    const yearWindiest = maxBy(thisYear, (d) => d.wind_speed);
    facts.push({ scope, text: `The windiest day this year hit ${Math.round(yearWindiest.wind_speed)} km/h, on ${shortDate(yearWindiest.date)}.` });
    const yearHottest = maxBy(thisYear, (d) => d.temperature);
    facts.push({ scope, text: `The warmest day this year reached ${one(yearHottest.temperature)}°C, on ${shortDate(yearHottest.date)}.` });
  }

  // This date in earlier years
  const sameDate = days.filter((d) => d.date.slice(5) === today.slice(5) && !d.date.startsWith(year));
  if (sameDate.length >= 2) {
    const scope = 'On this day';
    const dateGood = sameDate.filter(isGood).length;
    facts.push({ scope, text: `${shortDate(today)} has been a good day in ${dateGood} of the last ${sameDate.length} years.` });
    const warmest = maxBy(sameDate, (d) => d.temperature);
    facts.push({ scope, text: `The warmest ${shortDate(today)} on record was ${one(warmest.temperature)}°C, in ${warmest.date.slice(0, 4)}.` });
  }

  // The current run, counting back from yesterday
  const lastGood = [...days].reverse().find(isGood);
  if (lastGood) {
    const yesterday = format(subDays(parseISO(today), 1), 'yyyy-MM-dd');
    if (lastGood.date === yesterday) {
      let streak = 0;
      for (let d = yesterday; days.some((x) => x.date === d && isGood(x)); d = format(subDays(parseISO(d), 1), 'yyyy-MM-dd')) {
        streak += 1;
      }
      facts.push({
        scope: 'Right now',
        text: streak === 1 ? 'Yesterday was a good day.' : `The last ${streak} days have all been good days.`,
      });
    }
  }

  return facts;
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// The gloomy twin of calculateFunFacts: same data, same weather-only rule,
// shown in its own card beside the fun facts.
export const calculateNotSoFunFacts = (history: DailyWeatherRecord[], today: string): FunFact[] => {
  const days = prepare(history, today);
  if (!days) return [];

  const facts: FunFact[] = [];
  const allTime = (text: string) => facts.push({ scope: 'All time', text });
  const firstYear = days[0].date.slice(0, 4);
  const bad = days.filter((d) => !isGood(d));

  allTime(`${pct(bad.length, days.length)} of days since ${firstYear} haven't been good days. You've been warned.`);

  const badRun = longestRun(days, (d) => !isGood(d));
  if (badRun && badRun.length > 1) {
    allTime(`The longest stretch without a good day lasted ${badRun.length} days, from ${shortDate(badRun.start)} to ${longDate(badRun.end)}.`);
  }

  // Whole months without a single good day. A month only counts once it's
  // over and nearly fully recorded, so a gap or the current month can't
  // fake one.
  const months = new Map<string, { total: number; good: number }>();
  for (const d of days) {
    const key = d.date.slice(0, 7);
    const m = months.get(key) ?? { total: 0, good: 0 };
    m.total += 1;
    if (isGood(d)) m.good += 1;
    months.set(key, m);
  }
  const blankMonths = [...months.entries()]
    .filter(([key, m]) => key < today.slice(0, 7) && m.total >= 25 && m.good === 0)
    .map(([key]) => key)
    .sort();
  const monthName = (key: string) => format(parseISO(`${key}-01`), 'MMMM yyyy');
  if (blankMonths.length === 1) {
    allTime(`${monthName(blankMonths[0])} didn't have a single good day.`);
  } else if (blankMonths.length > 1) {
    allTime(`${blankMonths.length} whole months went by without a single good day, most recently ${monthName(blankMonths.at(-1)!)}.`);
  }

  // Weeks (Monday to Sunday, fully recorded) with a good weekday but a
  // weekend with none.
  const weeks = new Map<string, { days: number; weekdayGood: boolean; weekendGood: boolean }>();
  for (const d of days) {
    const date = parseISO(d.date);
    const dow = getDay(date);
    const monday = format(subDays(date, (dow + 6) % 7), 'yyyy-MM-dd');
    const w = weeks.get(monday) ?? { days: 0, weekdayGood: false, weekendGood: false };
    w.days += 1;
    if (isGood(d)) {
      if (dow === 0 || dow === 6) w.weekendGood = true;
      else w.weekdayGood = true;
    }
    weeks.set(monday, w);
  }
  const ruined = [...weeks.values()].filter((w) => w.days === 7 && w.weekdayGood && !w.weekendGood).length;
  if (ruined > 0) allTime(`${ruined === 1 ? 'Once' : `${ruined} times`}, the week had a good day and the weekend didn't. Classic.`);

  // Calm and dry, but a degree short.
  const nearMisses = days.filter(
    (d) => !isGood(d) && isGoodWeatherDay({ temperature: d.temperature + 1, windSpeed: d.wind_speed, rain: d.rain }, d.date),
  ).length;
  if (nearMisses > 0) {
    allTime(`${nearMisses.toLocaleString('en-NZ')} ${nearMisses === 1 ? 'day was' : 'days were'} calm and dry, and missed out by less than a degree. So close.`);
  }

  const tooWindy = days.filter((d) => d.wind_speed >= 30).length;
  allTime(`It's been too windy for a good day on ${pct(tooWindy, days.length)} of days. That's about ${Math.round((tooWindy / days.length) * 365)} days a year.`);

  const rainRun = longestRun(days, (d) => d.rain > 0.1);
  if (rainRun && rainRun.length > 2) {
    allTime(`The longest run of rainy days was ${rainRun.length} in a row, ending ${longDate(rainRun.end)}.`);
  }

  const bySeason = seasonShares(days);
  const seasons = [...bySeason.entries()].filter(([, s]) => s.total >= 30);
  if (seasons.length >= 2) {
    const [worstName, worst] = minBy(seasons, ([, s]) => s.good / s.total);
    allTime(`${worstName} is the worst season, managing a good day just ${pct(worst.good, worst.total)} of the time.`);
  }
  const shitsville = bySeason.get('Shitsville');
  if (shitsville && shitsville.total >= 30) {
    allTime(`${pct(shitsville.total - shitsville.good, shitsville.total)} of Shitsville days are bad. It earned the name.`);
  }

  const byMonth = Array.from({ length: 12 }, () => ({ total: 0, good: 0 }));
  for (const d of days) {
    const m = byMonth[Number(d.date.slice(5, 7)) - 1];
    m.total += 1;
    if (isGood(d)) m.good += 1;
  }
  const monthStats = byMonth.map((m, i) => ({ i, ...m })).filter((m) => m.total >= 30);
  if (monthStats.length >= 2) {
    const worst = minBy(monthStats, (m) => m.good / m.total);
    allTime(`${MONTH_NAMES[worst.i]} is the worst month, with a good day only ${pct(worst.good, worst.total)} of the time.`);
  }

  const summer = days.filter((d) => getSeasonLabel(d.date) === 'Summer');
  if (summer.length >= 30) {
    const coldSummer = minBy(summer, (d) => d.temperature);
    allTime(`The coldest day of summer (January to March) on record only reached ${one(coldSummer.temperature)}°C, on ${longDate(coldSummer.date)}.`);
  }

  // This year so far
  const year = today.slice(0, 4);
  const thisYear = days.filter((d) => d.date.startsWith(year));
  if (thisYear.length >= 14) {
    const scope = `${year} so far`;
    const yearBad = thisYear.filter((d) => !isGood(d)).length;
    facts.push({ scope, text: `${plural(yearBad, 'bad day')} out of ${thisYear.length} this year.` });
    const yearDrought = longestRun(thisYear, (d) => !isGood(d));
    if (yearDrought && yearDrought.length > 1) {
      facts.push({ scope, text: `The longest wait for a good day this year was ${yearDrought.length} days, ending ${shortDate(yearDrought.end)}.` });
    }
    const yearWettest = maxBy(thisYear, (d) => d.rain);
    if (yearWettest.rain > 0.1) {
      facts.push({ scope, text: `The wettest day this year dropped ${one(yearWettest.rain)}mm of rain in daylight hours, on ${shortDate(yearWettest.date)}.` });
    }
  }

  // This date in earlier years
  const sameDate = days.filter((d) => d.date.slice(5) === today.slice(5) && !d.date.startsWith(year));
  if (sameDate.length >= 2) {
    const scope = 'On this day';
    const dateBad = sameDate.filter((d) => !isGood(d)).length;
    if (dateBad > 0) {
      facts.push({ scope, text: `${shortDate(today)} has been a bad day in ${dateBad} of the last ${sameDate.length} years.` });
    }
    const coldest = minBy(sameDate, (d) => d.temperature);
    facts.push({ scope, text: `The coldest ${shortDate(today)} on record only got to ${one(coldest.temperature)}°C, in ${coldest.date.slice(0, 4)}.` });
  }

  // Right now
  const yesterday = format(subDays(parseISO(today), 1), 'yyyy-MM-dd');
  const lastGood = [...days].reverse().find(isGood);
  if (lastGood && lastGood.date !== yesterday) {
    const ago = daysBetween(lastGood.date, today);
    facts.push({ scope: 'Right now', text: `It's been ${plural(ago, 'day')} since the last good day, on ${longDate(lastGood.date)}.` });
  } else if (lastGood) {
    // Average length of a run of good days, for when things are going well.
    // A run starts on any good day whose previous day wasn't a recorded good day.
    const goodDates = new Set(days.filter(isGood).map((d) => d.date));
    const runs = [...goodDates].filter((date) => !goodDates.has(format(subDays(parseISO(date), 1), 'yyyy-MM-dd'))).length;
    const average = goodDates.size / runs;
    facts.push({ scope: 'Right now', text: `Enjoy it while it lasts. A run of good days lasts ${one(average)} days on average.` });
  }

  return facts;
};
