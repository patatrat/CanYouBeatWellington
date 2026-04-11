const defaultRules = {
  minTemp: 18,
  maxWind: 20,
  maxRain: 0,
};

export const saveRules = (rules) => {
  localStorage.setItem('wellingtonRules', JSON.stringify(rules));
};

export const loadRules = () => {
  const savedRules = localStorage.getItem('wellingtonRules');
  return savedRules ? JSON.parse(savedRules) : defaultRules;
};

// Returns the number of good-day criteria met (0–3).
// 3 = good day ("you can't beat Wellington"); fewer = bad day.
export const countCriteriaMet = (weather, rules) => {
  return [
    weather.temperature >= rules.minTemp,
    weather.windSpeed < rules.maxWind,
    weather.rain <= rules.maxRain,
  ].filter(Boolean).length;
};
