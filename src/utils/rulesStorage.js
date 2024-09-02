const defaultRules = {
  minTemp: 18,
  maxWind: 10,
  minSunnyness: 90,
  maxRain: 0
};

export const saveRules = (rules) => {
  localStorage.setItem('wellingtonRules', JSON.stringify(rules));
};

export const loadRules = () => {
  const savedRules = localStorage.getItem('wellingtonRules');
  return savedRules ? JSON.parse(savedRules) : defaultRules;
};