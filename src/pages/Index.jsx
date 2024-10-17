import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ExternalLink, Check, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadRules } from '../utils/rulesStorage';
import { supabase } from '../utils/supabase';
import { fetchAndStoreWeather } from '../utils/weatherStorage';
import WeatherStat from '../components/WeatherStat';

const Index = () => {
  const { data: weather, isLoading: weatherLoading, error: weatherError } = useQuery({
    queryKey: ['weather'],
    queryFn: fetchAndStoreWeather,
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

    const operation = existingRecord ? 'update' : 'insert';
    const { data, error } = await supabase
      .from('daily_weather_records')
      [operation](record)
      .eq('date', record.date);
    
    if (error) {
      console.error(`Error ${operation}ing record:`, error);
      throw error;
    }
    console.log(`Record ${operation}d successfully:`, data);
    return data;
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

  const isGoodDay = () => {
    if (!weather || !rules) return 0;
    return [
      weather.temperature >= rules.minTemp,
      weather.windSpeed < rules.maxWind,
      weather.sunniness >= rules.minSunniness,
      weather.rain <= rules.maxRain
    ].filter(Boolean).length;
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

  if (weatherError || rulesError) {
    return <div className="flex justify-center items-center h-screen">Error loading data. Please try again later.</div>;
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
            />
            <WeatherStat 
              label="Wind Speed" 
              value={`${weather.windSpeed.toFixed(1)} km/h`} 
              meets={weather.windSpeed < rules.maxWind}
            />
            <WeatherStat 
              label="Sunniness" 
              value={`${weather.sunniness}%`} 
              meets={weather.sunniness >= rules.minSunniness}
            />
            <WeatherStat 
              label="Daytime Rain" 
              value={`${weather.rain.toFixed(1)} mm`} 
              meets={weather.rain <= rules.maxRain}
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

export default Index;