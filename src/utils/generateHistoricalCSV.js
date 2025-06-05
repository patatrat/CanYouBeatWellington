
// Browser-based script to generate CSV file with historical weather data for Wellington
// Run this in the browser console or call generateAndDownloadCSV() from anywhere in the app

const calculateSunniness = (weatherCode) => {
  if (weatherCode <= 3) return 100;
  if (weatherCode <= 48) return 70;
  if (weatherCode <= 67) return 50;
  if (weatherCode <= 77) return 30;
  return 10;
};

const calculateDaytimeRain = (hourlyPrecipitation, dayIndex) => {
  // Each day has 24 hours, so we need to slice the correct 24-hour period
  const startHour = dayIndex * 24 + 6; // 6 AM
  const endHour = dayIndex * 24 + 18; // 6 PM
  const daytimeRain = hourlyPrecipitation.slice(startHour, endHour).reduce((sum, rain) => sum + (rain || 0), 0);
  return daytimeRain;
};

const isGoodDay = (temperature, windSpeed, sunniness, rain) => {
  const minTemp = 18;
  const maxWind = 20;
  const minSunniness = 90;
  const maxRain = 0;
  
  return temperature >= minTemp && 
         windSpeed < maxWind && 
         sunniness >= minSunniness && 
         rain <= maxRain;
};

const downloadCSV = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const generateAndDownloadCSV = async () => {
  console.log('🌤️ Starting historical weather CSV generation...');
  
  // Get as much historical data as possible (Open-Meteo allows up to ~2 years of historical data)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(endDate.getFullYear() - 2); // Go back 2 years
  
  const formatDate = (date) => date.toISOString().split('T')[0];
  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);
  
  console.log(`📅 Fetching data from ${startDateStr} to ${endDateStr}`);
  
  try {
    // Fetch historical weather data from Open-Meteo API
    console.log('🔄 Fetching weather data...');
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=-41.2866&longitude=174.7756&start_date=${startDateStr}&end_date=${endDateStr}&daily=weather_code,temperature_2m_max,wind_speed_10m_max&hourly=precipitation&timezone=Pacific%2FAuckland`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`📊 Received data for ${data.daily.time.length} days`);
    
    // Create CSV header
    const csvHeader = 'date,temperature,wind_speed,sunniness,rain,is_good_day\n';
    
    // Process each day's data and create CSV rows
    console.log('⚙️ Processing weather data...');
    const csvRows = [];
    for (let i = 0; i < data.daily.time.length; i++) {
      const date = data.daily.time[i];
      const temperature = data.daily.temperature_2m_max[i];
      const windSpeed = data.daily.wind_speed_10m_max[i];
      const sunniness = calculateSunniness(data.daily.weather_code[i]);
      const rain = calculateDaytimeRain(data.hourly.precipitation, i);
      const goodDay = isGoodDay(temperature, windSpeed, sunniness, rain);
      
      // Create CSV row
      const csvRow = `${date},${temperature},${windSpeed},${sunniness},${rain},${goodDay}`;
      csvRows.push(csvRow);
    }
    
    // Combine header and rows
    const csvContent = csvHeader + csvRows.join('\n');
    
    // Trigger download
    const filename = 'wellington-historical-weather.csv';
    downloadCSV(csvContent, filename);
    
    const goodDays = csvRows.filter(row => row.endsWith('true')).length;
    
    console.log('✅ CSV file generated and downloaded successfully!');
    console.log(`📁 File: ${filename}`);
    console.log(`📊 Total records: ${csvRows.length}`);
    console.log(`🌟 Good days found: ${goodDays}`);
    console.log(`📅 Date range: ${startDateStr} to ${endDateStr}`);
    console.log('\n📋 Next steps:');
    console.log('1. Open your Supabase dashboard');
    console.log('2. Go to the Table Editor');
    console.log('3. Select the "daily_weather_records" table');
    console.log('4. Click "Insert" > "Import data from CSV"');
    console.log('5. Upload the downloaded wellington-historical-weather.csv file');
    
    return {
      success: true,
      totalRecords: csvRows.length,
      goodDays: goodDays,
      filename: filename
    };
    
  } catch (error) {
    console.error('❌ Error generating historical weather CSV:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Make it available globally for easy console access
if (typeof window !== 'undefined') {
  window.generateWellingtonCSV = generateAndDownloadCSV;
}
