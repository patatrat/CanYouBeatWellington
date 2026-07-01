// Seasons use UTC month numbers (0 = Jan, 11 = Dec).
// Date strings from the DB and Open-Meteo are YYYY-MM-DD (parsed as UTC midnight),
// so getUTCMonth() gives the correct Wellington calendar month regardless of
// the visitor's browser timezone.

interface Season {
  label: string;
  months: number[];
  minTemp: number;
  maxWind: number;
  maxRain: number;
}

interface Thresholds {
  minTemp: number;
  maxWind: number;
  maxRain: number;
}

interface Weather {
  temperature: number;
  windSpeed: number;
  rain: number;
}

const SEASONS: Season[] = [
  { label: 'Summer',      months: [0, 1, 2],  minTemp: 19, maxWind: 30, maxRain: 0 },
  { label: 'Autumn',      months: [3],         minTemp: 16, maxWind: 30, maxRain: 0 },
  { label: 'Late Autumn', months: [4, 5],      minTemp: 14, maxWind: 30, maxRain: 0 },
  { label: 'Winter',      months: [6, 7],      minTemp: 13, maxWind: 30, maxRain: 0 },
  { label: 'Spring 1',    months: [8],         minTemp: 14, maxWind: 30, maxRain: 0 },
  { label: 'Shitsville',  months: [9, 10],     minTemp: 16, maxWind: 30, maxRain: 0 },
  { label: 'Spring 2',    months: [11],        minTemp: 18, maxWind: 30, maxRain: 0 },
];

const toDate = (date: Date | string): Date =>
  date instanceof Date ? date : new Date(date);

const getSeason = (date: Date | string): Season => {
  const month = toDate(date).getUTCMonth();
  const season = SEASONS.find(s => s.months.includes(month));
  if (!season) throw new Error(`No season found for month ${month}`);
  return season;
};

export const getSeasonLabel = (date: Date | string): string =>
  getSeason(date).label;

export const getThresholds = (date: Date | string): Thresholds => {
  const { minTemp, maxWind, maxRain } = getSeason(date);
  return { minTemp, maxWind, maxRain };
};

// Returns the number of good-day criteria met (0–3).
// 3 = good day ("you can't beat Wellington"); fewer = bad day.
// date defaults to today when omitted.
export const countCriteriaMet = (weather: Weather, date: Date | string = new Date()): number => {
  const { minTemp, maxWind, maxRain } = getThresholds(date);
  return [
    weather.temperature >= minTemp,
    weather.windSpeed < maxWind,
    weather.rain <= maxRain,
  ].filter(Boolean).length;
};

// The single definition of a good *weather* day — every verdict in the app
// (home page, daily cron, History calendar) must go through this so the
// pages can never disagree about the same day. A special date's
// verdict_override is applied on top via resolveVerdict(), not here.
export const isGoodWeatherDay = (weather: Weather, date: Date | string): boolean =>
  countCriteriaMet(weather, date) === 3;
