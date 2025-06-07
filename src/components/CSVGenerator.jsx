
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Loader2 } from 'lucide-react';

const CSVGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');

  const calculateSunniness = (weatherCode) => {
    // Weather codes for Visual Crossing (similar to Open-Meteo)
    if (weatherCode === 'clear-day' || weatherCode === 'clear-night') return 100;
    if (weatherCode === 'partly-cloudy-day' || weatherCode === 'partly-cloudy-night') return 70;
    if (weatherCode === 'cloudy') return 50;
    if (weatherCode === 'fog' || weatherCode === 'wind') return 30;
    if (weatherCode.includes('rain') || weatherCode.includes('snow')) return 10;
    return 60; // default for unknown conditions
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

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const fetchDataChunk = async (startDate, endDate, API_KEY) => {
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    
    const response = await fetch(
      `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/Wellington,NZ/${startDateStr}/${endDateStr}?key=${API_KEY}&include=days&elements=datetime,tempmax,windspeed,precip,conditions,icon&unitGroup=metric`
    );

    if (!response.ok) {
      if (response.status === 401) {
        const errorText = await response.text();
        if (errorText.includes('exceeds the maximum query cost')) {
          throw new Error('Query too large for free tier. Try reducing the date range.');
        }
        throw new Error('Invalid API key. Please check your Visual Crossing Weather API key.');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.days || [];
  };

  const generateCSV = async () => {
    setIsGenerating(true);
    setProgress('Starting data generation...');

    try {
      // Calculate date range - go back 5 years from March 15, 2025
      const endDate = new Date('2025-03-15');
      const startDate = new Date('2020-03-15'); // 5 years back
      
      const API_KEY = 'J24W9XFX9EY24DRFP6VCYNSWW';
      
      setProgress('Fetching data in chunks to stay within API limits...');

      let allDays = [];
      let currentStart = new Date(startDate);
      let chunkNumber = 1;
      
      while (currentStart < endDate) {
        // Create 6-month chunks to stay within API limits
        let currentEnd = new Date(currentStart);
        currentEnd.setMonth(currentEnd.getMonth() + 6);
        
        // Don't go beyond our end date
        if (currentEnd > endDate) {
          currentEnd = new Date(endDate);
        }
        
        setProgress(`Fetching chunk ${chunkNumber}: ${formatDate(currentStart)} to ${formatDate(currentEnd)}...`);
        
        try {
          const chunkDays = await fetchDataChunk(currentStart, currentEnd, API_KEY);
          allDays = allDays.concat(chunkDays);
          
          // Add a small delay between requests to be respectful to the API
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (chunkError) {
          console.error(`Error fetching chunk ${chunkNumber}:`, chunkError);
          setProgress(`⚠️ Warning: Failed to fetch data for ${formatDate(currentStart)} to ${formatDate(currentEnd)}. Continuing with remaining data...`);
        }
        
        // Move to next chunk
        currentStart = new Date(currentEnd);
        currentStart.setDate(currentStart.getDate() + 1);
        chunkNumber++;
      }

      setProgress(`Processing ${allDays.length} days of weather data...`);

      // Process the data to match our Supabase structure
      const records = allDays.map(day => {
        const temperature = day.tempmax || 0;
        const windSpeed = day.windspeed || 0;
        const sunniness = calculateSunniness(day.icon);
        const rain = day.precip || 0;
        
        return {
          date: day.datetime,
          temperature: temperature,
          wind_speed: windSpeed,
          sunniness: sunniness,
          rain: rain,
          is_good_day: isGoodDay(temperature, windSpeed, sunniness, rain),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          agree_count: 0,
          disagree_count: 0
        };
      });

      setProgress('Generating CSV file...');

      // Generate CSV content
      const headers = [
        'date',
        'temperature',
        'wind_speed',
        'sunniness',
        'rain',
        'is_good_day',
        'created_at',
        'updated_at',
        'agree_count',
        'disagree_count'
      ];

      const csvContent = [
        headers.join(','),
        ...records.map(record => 
          headers.map(header => {
            const value = record[header];
            // Handle boolean values
            if (typeof value === 'boolean') return value;
            // Handle string values that might contain commas
            if (typeof value === 'string' && value.includes(',')) {
              return `"${value}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `wellington_weather_history_2020_to_2025-03-15.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setProgress(`✅ Successfully generated CSV with ${records.length} records!`);
      
      // Show success message for a few seconds then clear
      setTimeout(() => {
        setProgress('');
      }, 3000);

    } catch (error) {
      console.error('Error generating CSV:', error);
      setProgress(`❌ Error: ${error.message}`);
      
      // Clear error message after a few seconds
      setTimeout(() => {
        setProgress('');
      }, 5000);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-center">
          <h2 className="text-2xl font-bold mb-4">Download Historical Weather Data</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          <p className="mb-4 text-gray-600">
            Generate a CSV file with historical weather data for Wellington from March 2020 to March 15, 2025.
          </p>
          <p className="mb-4 text-sm text-blue-600">
            Data will be fetched in chunks to work within API limits. This may take a few minutes.
          </p>
          
          <Button 
            onClick={generateCSV} 
            disabled={isGenerating}
            className="mb-4"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download CSV
              </>
            )}
          </Button>
          
          {progress && (
            <div className="mt-4 p-3 bg-gray-100 rounded-md">
              <p className="text-sm">{progress}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CSVGenerator;
