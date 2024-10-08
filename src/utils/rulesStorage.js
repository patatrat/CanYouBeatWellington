const defaultRules = {
  minTemp: 18,
  maxWind: 10,
  maxSunniness: 30,  // Changed from minSunniness to maxSunniness
  maxRain: 0
};

export const saveRules = (rules) => {
  localStorage.setItem('wellingtonRules', JSON.stringify(rules));
};

export const loadRules = () => {
  const savedRules = localStorage.getItem('wellingtonRules');
  return savedRules ? JSON.parse(savedRules) : defaultRules;
};