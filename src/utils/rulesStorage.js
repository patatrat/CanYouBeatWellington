const defaultRules = {
  minTemp: 18,
  maxWind: 20, // Updated from minWind to maxWind and set to 20
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