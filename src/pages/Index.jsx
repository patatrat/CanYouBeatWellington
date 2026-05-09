
import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getThresholds, getSeasonLabel, countCriteriaMet } from '../utils/rulesStorage';
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

  const weatherDate = weather?.timestamp ? new Date(weather.timestamp) : new Date();
  const rules = weather ? getThresholds(weatherDate) : null;
  const seasonLabel = getSeasonLabel(weatherDate);

  const storeDailyRecord = async (record) => {
    // Direct UPDATE is blocked by RLS for anon users, so we INSERT and ignore
    // duplicate-key conflicts (23505). The cron job (service role) handles
    // refreshing stale readings; the client just needs to ensure the row exists.
    const { error } = await supabase
      .from('daily_weather_records')
      .insert(record);

    if (error && error.code !== '23505') {
      console.error('Error inserting daily record:', error);
      throw error;
    }
  };

  const { mutate: storeMutate } = useMutation({
    mutationFn: storeDailyRecord,
    onSuccess: (data) => {
      console.log('Daily record stored or updated successfully:', data);
    },
    onError: (error) => {
      console.error('Error storing daily record:', error);
    }
  });

  React.useEffect(() => {
    if (weather) {
      const record = {
        date: weather.timestamp,
        temperature: weather.temperature,
        wind_speed: weather.windSpeed,
        sunniness: weather.sunniness,
        rain: weather.rain,
      };
      storeMutate(record);
    }
  }, [weather, storeMutate]);

  if (weatherLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (weatherError) {
    return <div className="flex justify-center items-center h-screen">Error loading data. Please try again later.</div>;
  }

  if (!weather) {
    return <div className="flex justify-center items-center h-screen">No weather data available. Please try again later.</div>;
  }

  const criteriaMetCount = weather ? countCriteriaMet(weather, weatherDate) : 0;

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

          <p className="text-sm text-gray-500 text-center mt-2 mb-2">
            {`It's currently `}<span className="font-medium">{seasonLabel}</span>{` season.`}
          </p>
          <p className="text-xs text-gray-400 text-center mb-4">
            {`Wellington's famous saying "you can't beat Wellington on a good day" — tracked daily since 2024.`}
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
