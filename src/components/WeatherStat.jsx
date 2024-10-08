import React from 'react';
import { Check, X, Thermometer, ThermometerSun, ThermometerSnowflake, Wind, Sun, Cloud, CloudSun, CloudRain } from 'lucide-react';

const WeatherStat = ({ label, value, meets }) => (
  <div className="text-center flex flex-col items-center">
    <h3 className="text-lg font-semibold">{label}</h3>
    <div className="flex items-center">
      {getIcon(label, value)}
      <p className="text-2xl mr-2">{value}</p>
      {meets ? (
        <Check className="h-6 w-6 text-green-500" />
      ) : (
        <X className="h-6 w-6 text-red-500" />
      )}
    </div>
  </div>
);

const getIcon = (label, value) => {
  switch (label) {
    case 'Temperature':
      return getTemperatureIcon(parseFloat(value));
    case 'Wind Speed':
      return <Wind className="h-6 w-6 mr-2" />;
    case 'Sunniness':
      return getSunIcon(parseFloat(value));
    case 'Daytime Rain':
      return <CloudRain className="h-6 w-6 mr-2" />;
    default:
      return null;
  }
};

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

export default WeatherStat;