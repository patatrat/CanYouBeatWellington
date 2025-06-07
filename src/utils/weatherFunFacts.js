
// Utility functions to calculate fun facts from historical weather data

export const calculateFunFacts = (history) => {
  if (!history || history.length === 0) {
    return [];
  }

  const facts = [];

  // Basic averages
  const avgTemp = history.reduce((sum, record) => sum + record.temperature, 0) / history.length;
  const avgWind = history.reduce((sum, record) => sum + record.wind_speed, 0) / history.length;
  const avgSunniness = history.reduce((sum, record) => sum + record.sunniness, 0) / history.length;
  const avgRain = history.reduce((sum, record) => sum + record.rain, 0) / history.length;

  facts.push(`The average temperature in Wellington is ${avgTemp.toFixed(1)}°C`);
  facts.push(`The average wind speed in Wellington is ${avgWind.toFixed(1)} km/h`);
  facts.push(`Wellington is sunny ${avgSunniness.toFixed(1)}% of the time on average`);
  facts.push(`Wellington receives an average of ${avgRain.toFixed(1)}mm of rain per day`);

  // Seasonal analysis
  const seasons = {
    summer: { months: [11, 0, 1], data: [] }, // Dec, Jan, Feb
    autumn: { months: [2, 3, 4], data: [] },   // Mar, Apr, May
    winter: { months: [5, 6, 7], data: [] },   // Jun, Jul, Aug
    spring: { months: [8, 9, 10], data: [] }   // Sep, Oct, Nov
  };

  history.forEach(record => {
    const month = new Date(record.date).getMonth();
    Object.keys(seasons).forEach(season => {
      if (seasons[season].months.includes(month)) {
        seasons[season].data.push(record);
      }
    });
  });

  Object.keys(seasons).forEach(season => {
    const seasonData = seasons[season].data;
    if (seasonData.length > 0) {
      const seasonAvgTemp = seasonData.reduce((sum, record) => sum + record.temperature, 0) / seasonData.length;
      facts.push(`The average temperature in ${season} is ${seasonAvgTemp.toFixed(1)}°C`);
    }
  });

  // Wind vs temperature correlation
  const windyDays = history.filter(record => record.wind_speed > 30); // Days with wind > 30 km/h
  const stillDays = history.filter(record => record.wind_speed <= 15); // Days with wind <= 15 km/h
  
  if (windyDays.length > 0 && stillDays.length > 0) {
    const windyAvgTemp = windyDays.reduce((sum, record) => sum + record.temperature, 0) / windyDays.length;
    const stillAvgTemp = stillDays.reduce((sum, record) => sum + record.temperature, 0) / stillDays.length;
    const tempDiff = stillAvgTemp - windyAvgTemp;
    
    if (tempDiff > 0) {
      facts.push(`Windy days (>30 km/h) are on average ${tempDiff.toFixed(1)}°C colder than still days (≤15 km/h)`);
    } else {
      facts.push(`Windy days (>30 km/h) are on average ${Math.abs(tempDiff).toFixed(1)}°C warmer than still days (≤15 km/h)`);
    }
  }

  // Good day statistics
  const goodDays = history.filter(record => record.is_good_day);
  const goodDayPercentage = (goodDays.length / history.length) * 100;
  facts.push(`Only ${goodDayPercentage.toFixed(1)}% of days in Wellington are considered "can't beat Wellington" days`);

  if (goodDays.length > 0) {
    const goodDayAvgTemp = goodDays.reduce((sum, record) => sum + record.temperature, 0) / goodDays.length;
    facts.push(`On good days, the average temperature is ${goodDayAvgTemp.toFixed(1)}°C`);
  }

  // Extreme weather facts
  const hottestDay = history.reduce((max, record) => record.temperature > max.temperature ? record : max);
  const coldestDay = history.reduce((min, record) => record.temperature < min.temperature ? record : min);
  const windiestDay = history.reduce((max, record) => record.wind_speed > max.wind_speed ? record : max);
  const rainiest = history.reduce((max, record) => record.rain > max.rain ? record : max);

  facts.push(`The hottest day recorded was ${hottestDay.temperature}°C on ${new Date(hottestDay.date).toLocaleDateString()}`);
  facts.push(`The coldest day recorded was ${coldestDay.temperature}°C on ${new Date(coldestDay.date).toLocaleDateString()}`);
  facts.push(`The windiest day recorded had winds of ${windiestDay.wind_speed} km/h on ${new Date(windiestDay.date).toLocaleDateString()}`);
  
  if (rainiest.rain > 0) {
    facts.push(`The rainiest day recorded had ${rainiest.rain}mm of rain on ${new Date(rainiest.date).toLocaleDateString()}`);
  }

  // Rain frequency
  const rainyDays = history.filter(record => record.rain > 0);
  const rainyDayPercentage = (rainyDays.length / history.length) * 100;
  facts.push(`It rains on ${rainyDayPercentage.toFixed(1)}% of days in Wellington`);

  // Perfect sunny days
  const perfectSunnyDays = history.filter(record => record.sunniness === 100);
  if (perfectSunnyDays.length > 0) {
    const perfectSunnyPercentage = (perfectSunnyDays.length / history.length) * 100;
    facts.push(`Wellington has 100% sunshine on ${perfectSunnyPercentage.toFixed(1)}% of days`);
  }

  // Wind patterns
  const calmDays = history.filter(record => record.wind_speed < 10);
  if (calmDays.length > 0) {
    const calmDayPercentage = (calmDays.length / history.length) * 100;
    facts.push(`Wellington has calm days (wind <10 km/h) only ${calmDayPercentage.toFixed(1)}% of the time`);
  }

  const veryWindyDays = history.filter(record => record.wind_speed > 50);
  if (veryWindyDays.length > 0) {
    const veryWindyPercentage = (veryWindyDays.length / history.length) * 100;
    facts.push(`Wellington experiences very windy days (>50 km/h) ${veryWindyPercentage.toFixed(1)}% of the time`);
  }

  return facts;
};

export const getRandomFunFact = (facts) => {
  if (!facts || facts.length === 0) return null;
  return facts[Math.floor(Math.random() * facts.length)];
};
