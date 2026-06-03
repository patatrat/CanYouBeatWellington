
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { getThresholds, getSeasonLabel } from '../utils/rulesStorage';
import { supabase } from '../integrations/supabase/client';
import { fetchAndStoreWeather } from '../utils/weatherStorage';
import { getScenario, pickQuip } from '../utils/quips';
import WeatherStat from '../components/WeatherStat';
import VotingButtons from '../components/VotingButtons';
import ForecastStrip from '../components/ForecastStrip';

const Index = () => {
  const { data: weather, isLoading: weatherLoading, error: weatherError } = useQuery({
    queryKey: ['weather'],
    queryFn: fetchAndStoreWeather,
    refetchInterval: 3600000,
  });

  const { data: todaysRecord } = useQuery({
    queryKey: ['todaysRecord', weather?.timestamp],
    queryFn: async () => {
      if (!weather) return null;
      const { data, error } = await supabase
        .from('daily_weather_records')
        .select('*')
        .eq('date', weather.timestamp)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!weather,
  });

  // Prefer the cron-written Supabase record for the verdict when it exists —
  // it captures the full daytime window with complete data, whereas the live
  // Open-Meteo fetch may reflect a stale forecast or a partially-elapsed day.
  const effectiveWeather = todaysRecord
    ? { ...weather, temperature: todaysRecord.temperature, windSpeed: todaysRecord.wind_speed, rain: todaysRecord.rain }
    : weather;

  const weatherDate = weather?.timestamp ? new Date(weather.timestamp + 'T12:00:00') : new Date();
  const rules = weather ? getThresholds(weatherDate) : null;
  const seasonLabel = getSeasonLabel(weatherDate);
  const isShitsville = seasonLabel === 'Shitsville';

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
    onError: (error) => console.error('Error storing daily record:', error),
  });

  const tempMet = effectiveWeather && rules ? effectiveWeather.temperature >= rules.minTemp : false;
  const windMet = effectiveWeather && rules ? effectiveWeather.windSpeed < rules.maxWind : false;
  const rainMet = effectiveWeather && rules ? effectiveWeather.rain <= rules.maxRain : false;
  const isGood = tempMet && windMet && rainMet;

  const verdictLine = useMemo(() => {
    if (!weather || !rules) return '';
    return pickQuip(getScenario(tempMet, windMet, rainMet));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather?.timestamp]);

  React.useEffect(() => {
    if (weather) {
      storeMutate({
        date: weather.timestamp,
        temperature: weather.temperature,
        wind_speed: weather.windSpeed,
        sunniness: weather.sunniness,
        rain: weather.rain,
      });
    }
  }, [weather, storeMutate]);

  if (weatherLoading) {
    return <div className="flex justify-center items-center h-screen bg-gray-50">Loading...</div>;
  }
  if (weatherError) {
    return <div className="flex justify-center items-center h-screen">Error loading data. Please try again later.</div>;
  }
  if (!weather) {
    return <div className="flex justify-center items-center h-screen">No weather data available.</div>;
  }

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-700 ${isGood ? 'bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100' : 'bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200'}`}>

      {/* Top-right nav */}
      <nav className="flex justify-end px-5 pt-4 gap-5 text-sm font-medium text-gray-500">
        <Link to="/about" className="hover:text-gray-800 transition-colors">Why though?</Link>
        <Link to="/history" className="hover:text-gray-800 transition-colors">The record</Link>
      </nav>

      <div className="flex flex-col items-center justify-center flex-1 px-6 py-6">

        {/* Season badge */}
        <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-6 ${isShitsville ? 'bg-slate-700 text-slate-100' : 'bg-amber-200 text-amber-800'}`}>
          {seasonLabel} season
        </span>

        {/* Question */}
        <h1 className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-2">
          Can you beat Wellington today?
        </h1>

        {/* Verdict */}
        <p className={`text-[8rem] sm:text-[10rem] leading-none font-black mb-3 ${isGood ? 'text-green-600' : 'text-red-500'}`}>
          {isGood ? 'NO' : 'YES'}
        </p>

        {/* Cheeky line — no max-width so quips stay on one line */}
        <p className="text-sm text-gray-500 text-center mb-8 italic whitespace-nowrap">
          {verdictLine}
        </p>

        {/* Weather stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-10 mb-6">
          <WeatherStat
            label="Temperature"
            value={`${effectiveWeather.temperature.toFixed(1)}°C`}
            meets={effectiveWeather.temperature >= rules.minTemp}
            threshold={`≥ ${rules.minTemp}°C`}
          />
          <WeatherStat
            label="Wind"
            value={`${effectiveWeather.windSpeed.toFixed(1)} km/h`}
            meets={effectiveWeather.windSpeed < rules.maxWind}
            threshold={`< ${rules.maxWind} km/h`}
          />
          <WeatherStat
            label="Rain"
            value={`${effectiveWeather.rain.toFixed(1)} mm`}
            meets={effectiveWeather.rain <= rules.maxRain}
            threshold="0 mm"
          />
        </div>

        {/* Voting */}
        {todaysRecord && <VotingButtons key={todaysRecord.date} weatherRecord={todaysRecord} />}

        {/* Forecast */}
        {weather?.forecast && <ForecastStrip forecast={weather.forecast} isGoodBackground={isGood} />}

        {/* Attribution */}
        <p className="text-xs text-gray-400 text-center mt-5">
          Updated {format(parseISO(weather.timestamp), 'PPP')} ·{' '}
          <a href={weather.source} target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 underline underline-offset-2">
            open-meteo.com <ExternalLink className="inline-block w-3 h-3 ml-0.5" />
          </a>
        </p>

      </div>
    </div>
  );
};

export default Index;
