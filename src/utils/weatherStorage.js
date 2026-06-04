const WEATHER_STORAGE_KEY = 'WeatherApp:latestWeather';

export const saveWeatherData = (weatherData) => {
  try {
    localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(weatherData));
  } catch (e) {
    console.error('Error saving weather data', e);
  }
};

export const getStoredWeatherData = () => {
  try {
    const jsonValue = localStorage.getItem(WEATHER_STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error('Error reading weather data', e);
    return null;
  }
};

export const fetchAndStoreWeather = async () => {
  const response = await fetch(
    'https://api.open-meteo.com/v1/forecast' +
    '?latitude=-41.2866&longitude=174.7756' +
    '&daily=weather_code,temperature_2m_max' +
    '&hourly=precipitation,wind_speed_10m' +
    '&timezone=Pacific%2FAuckland'
  );
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data = await response.json();

  if (
    !data.daily?.time?.[0] ||
    data.daily?.temperature_2m_max?.[0] === undefined ||
    data.daily?.weather_code?.[0] === undefined ||
    !Array.isArray(data.hourly?.precipitation) ||
    !Array.isArray(data.hourly?.wind_speed_10m) ||
    data.hourly.precipitation.length < 18 ||
    data.hourly.wind_speed_10m.length < 18
  ) {
    throw new Error('Open-Meteo API returned incomplete data');
  }

  const today = {
    temperature: data.daily.temperature_2m_max[0],
    windSpeed:   calculateDaytimeWind(data.hourly.wind_speed_10m, 0),
    sunniness:   calculateSunniness(data.daily.weather_code[0]),
    rain:        calculateDaytimeRain(data.hourly.precipitation, 0),
    timestamp:   data.daily.time[0],
    source:      'https://open-meteo.com/',
    // Days 1–6 (tomorrow → 6 days out). Day 0 is today, already shown above.
    forecast: data.daily.time.slice(1).map((date, i) => ({
      date,
      temperature: data.daily.temperature_2m_max[i + 1],
      windSpeed:   calculateDaytimeWind(data.hourly.wind_speed_10m, i + 1),
      rain:        calculateDaytimeRain(data.hourly.precipitation, i + 1),
    })),
  };

  saveWeatherData(today);
  return today;
};

export const calculateSunniness = (weatherCode) => {
  if (weatherCode <= 3)  return 100;
  if (weatherCode <= 48) return 70;
  if (weatherCode <= 67) return 50;
  if (weatherCode <= 77) return 30;
  return 10;
};

// Sums precipitation for daytime hours only (6 AM–6 PM) for a given day index
// within the full multi-day hourly array returned by Open-Meteo.
export const calculateDaytimeRain = (hourlyPrecipitation, dayIndex = 0) => {
  const start = dayIndex * 24 + 6;
  const end   = dayIndex * 24 + 18;
  return hourlyPrecipitation.slice(start, end).reduce((sum, rain) => sum + (rain || 0), 0);
};

// Average wind speed during daytime hours only (6 AM–6 PM) for a given day index.
// Using daytime average instead of daily max avoids penalising calm days for evening gusts.
export const calculateDaytimeWind = (hourlyWind, dayIndex = 0) => {
  const start = dayIndex * 24 + 6;
  const end   = dayIndex * 24 + 18;
  const slice = hourlyWind.slice(start, end);
  if (!slice.length) return 0;
  return slice.reduce((sum, w) => sum + (w || 0), 0) / slice.length;
};
