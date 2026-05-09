// Seasons use UTC month numbers (0 = Jan, 11 = Dec).
// Date strings from the DB and Open-Meteo are YYYY-MM-DD (parsed as UTC midnight),
// so getUTCMonth() gives the correct Wellington calendar month regardless of
// the visitor's browser timezone.
const SEASONS = [
  { label: 'Summer',     months: [0, 1, 2],  minTemp: 19, maxWind: 30, maxRain: 0 },
  { label: 'Autumn',     months: [3, 4, 5],  minTemp: 16, maxWind: 30, maxRain: 0 },
  { label: 'Winter',     months: [6, 7],     minTemp: 13, maxWind: 30, maxRain: 0 },
  { label: 'Spring 1',   months: [8],        minTemp: 14, maxWind: 30, maxRain: 0 },
  { label: 'Shitsville', months: [9, 10],    minTemp: 16, maxWind: 30, maxRain: 0 },
  { label: 'Spring 2',   months: [11],       minTemp: 18, maxWind: 30, maxRain: 0 },
];

const toDate = (date) => (date instanceof Date ? date : new Date(date));

const getSeason = (date) => {
  const month = toDate(date).getUTCMonth();
  return SEASONS.find(s => s.months.includes(month));
};

export const getSeasonLabel = (date) => getSeason(date).label;

export const getThresholds = (date) => {
  const { minTemp, maxWind, maxRain } = getSeason(date);
  return { minTemp, maxWind, maxRain };
};

// Returns the number of good-day criteria met (0–3).
// 3 = good day ("you can't beat Wellington"); fewer = bad day.
// date defaults to today when omitted.
export const countCriteriaMet = (weather, date = new Date()) => {
  const { minTemp, maxWind, maxRain } = getThresholds(date);
  return [
    weather.temperature >= minTemp,
    weather.windSpeed < maxWind,
    weather.rain <= maxRain,
  ].filter(Boolean).length;
};
