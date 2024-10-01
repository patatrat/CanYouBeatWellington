import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ExternalLink, Check, X, Thermometer, ThermometerSun, ThermometerSnowflake, Wind, Sun, Cloud, CloudSun, CloudRain } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadRules } from '../utils/rulesStorage';
import { supabase } from '../utils/supabase';

const fetchWeather = async () => {
  try {
    const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-41.2866&longitude=174.7756&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,wind_speed_10m_max,wind_speed_10m_min&timezone=Pacific%2FAuckland');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('Fetched weather data:', data);
    
    // Process the data
    const today = {
      temperature: data.daily.temperature_2m_max[0], // Highest temperature of the day
      windSpeed: data.daily.wind_speed_10m_min[0], // Lowest wind speed of the day
      sunniness: calculateSunniness(data.daily.weather_code[0], data.daily.precipitation_sum[0]),
      rain: data.daily.precipitation_sum[0],
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

const calculateSunniness = (weatherCode, precipitationSum) => {
  // Simple logic to estimate sunniness based on weather code and precipitation
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

  const storeDailyRecord = async (record) => {
    const { data: existingRecord, error: fetchError } = await supabase
      .from('daily_weather_records')
      .select('*')
      .eq('date', record.date)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking for existing record:', fetchError);
      throw fetchError;
    }

    if (existingRecord) {
      console.log('Updating existing record for', record.date);
      const { data, error } = await supabase
        .from('daily_weather_records')
        .update(record)
        .eq('date', record.date);
      
      if (error) {
        console.error('Error updating record:', error);
        throw error;
      }
      console.log('Record updated successfully:', data);
      return data;
    } else {
      console.log('Inserting new record for', record.date);
      const { data, error } = await supabase
        .from('daily_weather_records')
        .insert([record]);
      
      if (error) {
        console.error('Error inserting record:', error);
        throw error;
      }
      console.log('New record inserted successfully:', data);
      return data;
    }
  };

  const mutation = useMutation({
    mutationFn: storeDailyRecord,
    onSuccess: (data) => {
      console.log('Daily record stored or updated successfully:', data);
    },
    onError: (error) => {
      console.error('Error storing daily record:', error);
    }
  });

  console.log('Weather data:', weather);
  console.log('Rules data:', rules);

  const isGoodDay = () => {
    if (!weather || !rules) return false;
    let criteriaMetCount = 0;
    if (weather.temperature >= rules.minTemp) criteriaMetCount++;
    if (weather.windSpeed < rules.maxWind) criteriaMetCount++;
    if (weather.sunniness >= rules.minSunniness) criteriaMetCount++;
    if (weather.rain <= rules.maxRain) criteriaMetCount++;
    return criteriaMetCount;
  };

  React.useEffect(() => {
    if (weather && rules) {
      const criteriaMetCount = isGoodDay();
      const record = {
        date: weather.timestamp,
        is_good_day: criteriaMetCount === 4,
        temperature: weather.temperature,
        wind_speed: weather.windSpeed,
        sunniness: weather.sunniness,
        rain: weather.rain
      };
      mutation.mutate(record);
    }
  }, [weather, rules]);

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

  const criteriaMetCount = isGoodDay();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-center">
            <h1 className="text-6xl font-bold mb-4">{criteriaMetCount === 4 ? "NO" : 'YES'}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl text-center mb-8">
            {criteriaMetCount === 4
              ? "You can't beat Wellington today"
              : criteriaMetCount === 3
              ? "Three out of four ain't bad. It is so close to being a good day, but not quite there yet. You can still beat Wellington today."
              : "You can beat Wellington today... it's not a good day"}
          </p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <WeatherStat 
              label="Temperature" 
              value={`${weather.temperature.toFixed(1)}°C`} 
              meets={weather.temperature >= rules.minTemp}
              icon={getTemperatureIcon(weather.temperature)}
            />
            <WeatherStat 
              label="Wind Speed" 
              value={`${weather.windSpeed.toFixed(1)} km/h`} 
              meets={weather.windSpeed < rules.maxWind}
              icon={<Wind className="h-6 w-6 mr-2" />}
            />
            <WeatherStat 
              label="Sunniness" 
              value={`${weather.sunniness}%`} 
              meets={weather.sunniness >= rules.minSunniness}
              icon={getSunIcon(weather.sunniness)}
            />
            <WeatherStat 
              label="Rain" 
              value={`${weather.rain.toFixed(1)} mm`} 
              meets={weather.rain <= rules.maxRain}
              icon={<CloudRain className="h-6 w-6 mr-2" />}
            />
          </div>
          <p className="text-sm text-center mb-2">
            Weather updated {format(parseISO(weather.timestamp), 'PPP')}
          </p>
          <div className="flex justify-center mb-6">
            <a 
              href={weather.source} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-500 hover:text-blue-700 flex items-center"
            >
              Weather data provided by open-meteo.com <ExternalLink className="ml-1 h-4 w-4" />
            </a>
          </div>
        </CardContent>
      </Card>
      <div className="mt-4">
        <Link to="/about" className="text-blue-500 hover:text-blue-700">
          What is this?
        </Link>
      </div>
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

const getSunIcon = (sunniness) => {
  if (sunniness >= 90) {
    return <Sun className="h-6 w-6 mr-2 text-yellow-500" />;
  } else if (sunniness >= 60) {
    return <CloudSun className="h-6 w-6 mr-2 text-yellow-400" />;
  } else {
    return <Cloud className="h-6 w-6 mr-2 text-gray-400" />;
  }
};

const getTemperatureIcon = (temperature) => {
  if (temperature >= 25) {
    return <ThermometerSun className="h-6 w-6 mr-2 text-red-500" />;
  } else if (temperature <= 10) {
    return <ThermometerSnowflake className="h-6 w-6 mr-2 text-blue-500" />;
  } else {
    return <Thermometer className="h-6 w-6 mr-2 text-gray-500" />;
  }
};

export default Index;