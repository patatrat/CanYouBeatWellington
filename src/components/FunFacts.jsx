
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb } from 'lucide-react';
import { calculateFunFacts, getRandomFunFact } from '../utils/weatherFunFacts';

const FunFacts = ({ history }) => {
  const randomFact = useMemo(() => {
    if (!history) return null;
    
    // Debug logging for December and January
    const decemberJanuaryData = history.filter(record => {
      const date = new Date(record.date);
      const month = date.getMonth();
      return month === 11 || month === 0; // December (11) or January (0)
    });
    
    if (decemberJanuaryData.length > 0) {
      console.log('December/January weather data analysis:');
      console.log(`Total records: ${decemberJanuaryData.length}`);
      
      const goodDays = decemberJanuaryData.filter(record => record.is_good_day);
      console.log(`Good days: ${goodDays.length}`);
      
      const failedTemp = decemberJanuaryData.filter(record => record.temperature < 18);
      const failedWind = decemberJanuaryData.filter(record => record.wind_speed >= 20);
      const failedRain = decemberJanuaryData.filter(record => record.rain > 0);
      
      console.log(`Days failing temperature (< 18°C): ${failedTemp.length}`);
      console.log(`Days failing wind speed (>= 20 km/h): ${failedWind.length}`);
      console.log(`Days failing rain (> 0mm): ${failedRain.length}`);
      
      // Show some specific examples
      const badDays = decemberJanuaryData.filter(record => !record.is_good_day).slice(0, 5);
      console.log('Sample bad days:', badDays.map(record => ({
        date: record.date,
        temp: record.temperature,
        wind: record.wind_speed,
        rain: record.rain,
        reasons: [
          record.temperature < 18 ? 'temp too low' : null,
          record.wind_speed >= 20 ? 'wind too high' : null,
          record.rain > 0 ? 'rain' : null
        ].filter(Boolean)
      })));
      
      // Average conditions for these months
      const avgTemp = decemberJanuaryData.reduce((sum, r) => sum + r.temperature, 0) / decemberJanuaryData.length;
      const avgWind = decemberJanuaryData.reduce((sum, r) => sum + r.wind_speed, 0) / decemberJanuaryData.length;
      const avgRain = decemberJanuaryData.reduce((sum, r) => sum + r.rain, 0) / decemberJanuaryData.length;
      
      console.log(`December/January averages - Temp: ${avgTemp.toFixed(1)}°C, Wind: ${avgWind.toFixed(1)} km/h, Rain: ${avgRain.toFixed(1)}mm`);
    }
    
    const facts = calculateFunFacts(history);
    return getRandomFunFact(facts);
  }, [history]);

  if (!randomFact) {
    return null;
  }

  return (
    <Card className="w-full max-w-2xl mb-8">
      <CardHeader>
        <CardTitle className="text-center flex items-center justify-center gap-2">
          <Lightbulb className="w-6 h-6 text-yellow-500" />
          <h2 className="text-2xl font-bold">Wellington Weather Fun Fact</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-lg text-center font-medium text-gray-700 italic">
          "{randomFact}"
        </p>
        <p className="text-sm text-center text-gray-500 mt-2">
          Refresh the page to see another fun fact!
        </p>
      </CardContent>
    </Card>
  );
};

export default FunFacts;
