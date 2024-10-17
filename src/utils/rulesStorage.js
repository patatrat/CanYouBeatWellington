const defaultRules = {
  minTemp: 18,
  minWind: 20, // Updated from maxWind to minWind and set to 20
  minSunniness: 90,
  maxRain: 0
};

export const saveRules = (rules) => {
  localStorage.setItem('wellingtonRules', JSON.stringify(rules));
};

export const loadRules = () => {
  const savedRules = localStorage.getItem('wellingtonRules');
  return savedRules ? JSON.parse(savedRules) : defaultRules;
};