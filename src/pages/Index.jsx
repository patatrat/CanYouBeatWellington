import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { ExternalLink, Check, X, Thermometer } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadRules } from '../utils/rulesStorage';

const fetchWeather = async () => {
  try {
    const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-41.2866&longitude=174.7756&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max&timezone=Pacific%2FAuckland');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('Fetched weather data:', data);
    
    // Process the data
    const today = {
      temperature: (data.daily.temperature_2m_max[0] + data.daily.temperature_2m_min[0]) / 2,
      windSpeed: data.daily.wind_speed_10m_max[0],
      sunnyness: calculateSunnyness(data.daily.weather_code[0], data.daily.precipitation_sum[0]),
      timestamp: data.daily.time[0],
      source: 'https://open-meteo.com/'
    };
    
    console.log('Processed weather data:', today);
    return today;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    throw error;
  }
};

const calculateSunnyness = (weatherCode, precipitationSum) => {
  // Simple logic to estimate sunnyness based on weather code and precipitation
  if (weatherCode <= 3) return 100; // Clear sky or mainly clear
  if (weatherCode <= 48) return 70; // Cloudy conditions
  if (weatherCode <= 67) return 50; // Rain
  if (weatherCode <= 77) return 30; // Snow
  return 10; // Thunderstorm
};

const Index = () => {
  const { data: weather, isLoading: weatherLoading, error: weatherError } = useQuery({
    queryKey: ['weather'],
    queryFn: fetchWeather,
    refetchInterval: 3600000 // Refetch every hour
  });

  const { data: rules, isLoading: rulesLoading, error: rulesError } = useQuery({
    queryKey: ['rules'],
    queryFn: loadRules
  });

  console.log('Weather data:', weather);
  console.log('Rules data:', rules);

  const isGoodDay = () => {
    if (!weather || !rules) return false;
    return (
      weather.temperature >= rules.minTemp &&
      weather.windSpeed < rules.maxWind &&
      weather.sunnyness >= rules.minSunnyness
    );
  };

  if (weatherLoading || rulesLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (weatherError) {
    console.error('Weather error:', weatherError);
    return <div className="flex justify-center items-center h-screen">Error loading weather data. Please try again later.</div>;
  }

  if (rulesError) {
    console.error('Rules error:', rulesError);
    return <div className="flex justify-center items-center h-screen">Error loading rules. Please try again later.</div>;
  }

  if (!weather) {
    return <div className="flex justify-center items-center h-screen">No weather data available. Please try again later.</div>;
  }

  const goodDay = isGoodDay();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-center">
            <h1 className="text-6xl font-bold mb-4">{goodDay ? "NO" : 'YES'}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl text-center mb-8">
            {goodDay
              ? "You can't beat Wellington today"
              : "You can beat Wellington today"}
          </p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <WeatherStat 
              label="Temperature" 
              value={`${weather.temperature.toFixed(1)}°C`} 
              meets={weather.temperature >= rules.minTemp}
              icon={<Thermometer className="h-6 w-6 mr-2" />}
            />
            <WeatherStat 
              label="Wind Speed" 
              value={`${weather.windSpeed.toFixed(1)} km/h`} 
              meets={weather.windSpeed < rules.maxWind}
            />
            <WeatherStat 
              label="Sunnyness" 
              value={`${weather.sunnyness}%`} 
              meets={weather.sunnyness >= rules.minSunnyness}
            />
          </div>
          <p className="text-sm text-center mb-2">
            Weather forecast for: {format(parseISO(weather.timestamp), 'PPP')}
          </p>
          <div className="flex justify-center mb-6">
            <a 
              href={weather.source} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-500 hover:text-blue-700 flex items-center"
            >
              Weather data source <ExternalLink className="ml-1 h-4 w-4" />
            </a>
          </div>
          <div className="flex justify-center">
            <Link to="/admin">
              <Button>Admin Settings</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const WeatherStat = ({ label, value, meets, icon }) => (
  <div className="text-center flex flex-col items-center">
    <h3 className="text-lg font-semibold">{label}</h3>
    <div className="flex items-center">
      {icon && icon}
      <p className="text-2xl mr-2">{value}</p>
      {meets ? (
        <Check className="h-6 w-6 text-green-500" />
      ) : (
        <X className="h-6 w-6 text-red-500" />
      )}
    </div>
  </div>
);

export default Index;