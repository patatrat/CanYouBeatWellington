import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";

const fetchWeather = async () => {
  // Replace with actual API call
  return {
    temperature: 20,
    windSpeed: 10,
    sunnyness: 80
  };
};

const fetchRules = async () => {
  // Replace with actual API call or local storage
  return {
    maxTemp: 25,
    maxWind: 15,
    minSunnyness: 70
  };
};

const Index = () => {
  const { data: weather, isLoading: weatherLoading } = useQuery({
    queryKey: ['weather'],
    queryFn: fetchWeather
  });

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ['rules'],
    queryFn: fetchRules
  });

  const isGoodDay = () => {
    if (!weather || !rules) return false;
    return (
      weather.temperature <= rules.maxTemp &&
      weather.windSpeed <= rules.maxWind &&
      weather.sunnyness >= rules.minSunnyness
    );
  };

  if (weatherLoading || rulesLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  const goodDay = isGoodDay();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-9xl font-bold mb-4">{goodDay ? 'NO' : 'YES'}</h1>
      <p className="text-2xl mb-8">
        {goodDay
          ? "You can't beat Wellington on a good day"
          : 'You can beat Wellington today'}
      </p>
      <div className="text-lg mb-8">
        <p>Temperature: {weather.temperature}°C</p>
        <p>Wind Speed: {weather.windSpeed} km/h</p>
        <p>Sunnyness: {weather.sunnyness}%</p>
      </div>
      <Link to="/admin">
        <Button>Admin Settings</Button>
      </Link>
    </div>
  );
};

export default Index;