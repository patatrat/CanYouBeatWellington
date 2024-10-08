import AsyncStorage from '@react-native-async-storage/async-storage';

const WEATHER_STORAGE_KEY = '@WeatherApp:latestWeather';

export const saveWeatherData = async (weatherData) => {
  try {
    const jsonValue = JSON.stringify(weatherData);
    await AsyncStorage.setItem(WEATHER_STORAGE_KEY, jsonValue);
  } catch (e) {
    console.error('Error saving weather data', e);
  }
};

export const getStoredWeatherData = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(WEATHER_STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error('Error reading weather data', e);
    return null;
  }
};

export const fetchAndStoreWeather = async () => {
  try {
    const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-41.2866&longitude=174.7756&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,wind_speed_10m_max,wind_gusts_10m_max&hourly=precipitation&timezone=Pacific%2FAuckland');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    const today = {
      temperature: (data.daily.temperature_2m_max[0] + data.daily.temperature_2m_min[0]) / 2,
      windSpeed: data.daily.wind_speed_10m_max[0],
      sunniness: calculateSunniness(data.daily.weather_code[0]),
      rain: calculateDaytimeRain(data.hourly.precipitation),
      timestamp: data.daily.time[0],
      source: 'https://open-meteo.com/'
    };
    
    await saveWeatherData(today);
    return today;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    throw error;
  }
};

const calculateSunniness = (weatherCode) => {
  if (weatherCode <= 3) return 100;
  if (weatherCode <= 48) return 70;
  if (weatherCode <= 67) return 50;
  if (weatherCode <= 77) return 30;
  return 10;
};

const calculateDaytimeRain = (hourlyPrecipitation) => {
  // Assuming daytime is from 6 AM to 6 PM (indices 6 to 17 in the hourly data)
  const daytimeRain = hourlyPrecipitation.slice(6, 18).reduce((sum, rain) => sum + rain, 0);
  return daytimeRain;
};