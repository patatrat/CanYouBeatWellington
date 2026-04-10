
import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ExternalLink, Check, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadRules } from '../utils/rulesStorage';
import { supabase } from '../integrations/supabase/client';
import { fetchAndStoreWeather } from '../utils/weatherStorage';
import WeatherStat from '../components/WeatherStat';
import VotingButtons from '../components/VotingButtons';

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

  // Fetch today's weather record for voting
  const { data: todaysRecord } = useQuery({
    queryKey: ['todaysRecord', weather?.timestamp],
    queryFn: async () => {
      if (!weather) return null;
      
      const { data, error } = await supabase
        .from('daily_weather_records')
        .select('*')
        .eq('date', weather.timestamp)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching today\'s record:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!weather
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
      const { data, error } = await supabase
        .from('daily_weather_records')
        .update({
          temperature: record.temperature,
          wind_speed: record.wind_speed,
          sunniness: record.sunniness,
          rain: record.rain,
        })
        .eq('date', record.date)
        .select();
      
      if (error) {
        console.error('Error updating record:', error);
        throw error;
      }
      console.log('Record updated successfully:', data);
      return data;
    } else {
      const { data, error } = await supabase
        .from('daily_weather_records')
        .insert(record)
        .select();
      
      if (error) {
        console.error('Error inserting record:', error);
        throw error;
      }
      console.log('Record inserted successfully:', data);
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

  const isGoodDay = () => {
    if (!weather || !rules) return 0;
    return [
      weather.temperature >= rules.minTemp,
      weather.windSpeed < rules.maxWind,
      weather.rain <= rules.maxRain
    ].filter(Boolean).length;
  };

  React.useEffect(() => {
    if (weather && rules) {
      const criteriaMetCount = isGoodDay();
      const record = {
        date: weather.timestamp,
        temperature: weather.temperature,
        wind_speed: weather.windSpeed,
        sunniness: weather.sunniness,
        rain: weather.rain,
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
            <h1 className="text-xl font-semibold text-gray-500 mb-2">Can you beat Wellington today?</h1>
            <p className="text-6xl font-bold mb-4">{criteriaMetCount === 3 ? "NO" : 'YES'}</p>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl text-center mb-8">
            {criteriaMetCount === 3
              ? "You can't beat Wellington today"
              : criteriaMetCount === 2
              ? "Two out of three ain't bad. It is so close to being a good day, but not quite there yet. You can still beat Wellington today."
              : "You can beat Wellington today... it's not a good day"}
          </p>
          <div className="grid grid-cols-3 gap-4 mb-6">
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
              label="Daytime Rain" 
              value={`${weather.rain.toFixed(1)} mm`} 
              meets={weather.rain <= rules.maxRain}
            />
          </div>

          {todaysRecord && (
            <VotingButtons weatherRecord={todaysRecord} />
          )}

          <p className="text-xs text-gray-400 text-center mt-2 mb-4">
            Wellington's famous saying "you can't beat Wellington on a good day" — tracked daily since 2024.
          </p>
          <p className="text-sm text-center mb-2 mt-6">
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
