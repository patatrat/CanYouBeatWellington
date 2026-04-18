/**
 * Shared utilities used by populate-db.js and backfill-historical.js.
 * Keep this file free of Supabase/network dependencies.
 */

export const calculateSunniness = (weatherCode) => {
  if (weatherCode <= 3) return 100;
  if (weatherCode <= 48) return 70;
  if (weatherCode <= 67) return 50;
  if (weatherCode <= 77) return 30;
  return 10;
};

// dayIndex 0 = today in a multi-day hourly array (each day = 24 entries).
export const calculateDaytimeRain = (hourlyPrecipitation, dayIndex) => {
  const startHour = dayIndex * 24 + 6;
  const endHour = dayIndex * 24 + 18;
  return hourlyPrecipitation
    .slice(startHour, endHour)
    .reduce((sum, rain) => sum + (rain || 0), 0);
};
