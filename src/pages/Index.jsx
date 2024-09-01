import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { ExternalLink, Check, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadRules } from '../utils/rulesStorage';

const fetchWeather = async () => {
  // Replace with actual API call
  const response = {
    temperature: 20,
    windSpeed: 10,
    sunnyness: 80,
    timestamp: new Date().toISOString(),
    source: 'https://www.metservice.com/towns-cities/locations/wellington'
  };
  return response;
};

const Index = () => {
  const { data: weather, isLoading: weatherLoading } = useQuery({
    queryKey: ['weather'],
    queryFn: fetchWeather,
    refetchInterval: 300000 // Refetch every 5 minutes
  });

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ['rules'],
    queryFn: loadRules
  });

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
              value={`${weather.temperature}°C`} 
              meets={weather.temperature >= rules.minTemp}
            />
            <WeatherStat 
              label="Wind Speed" 
              value={`${weather.windSpeed} km/h`} 
              meets={weather.windSpeed < rules.maxWind}
            />
            <WeatherStat 
              label="Sunnyness" 
              value={`${weather.sunnyness}%`} 
              meets={weather.sunnyness >= rules.minSunnyness}
            />
          </div>
          <p className="text-sm text-center mb-2">
            Weather checked at: {format(parseISO(weather.timestamp), 'PPpp')}
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

const WeatherStat = ({ label, value, meets }) => (
  <div className="text-center flex flex-col items-center">
    <h3 className="text-lg font-semibold">{label}</h3>
    <div className="flex items-center">
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