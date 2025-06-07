
import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MonthlyGoodDaysChart = ({ history }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const availableYears = useMemo(() => {
    if (!history) return [];
    
    const years = new Set();
    history.forEach(record => {
      const date = new Date(record.date);
      years.add(date.getFullYear());
    });
    
    return Array.from(years).sort((a, b) => a - b);
  }, [history]);

  const monthlyData = useMemo(() => {
    if (!history) return [];

    // Group data by month for the selected year and count good days
    const monthCounts = {};
    
    // Initialize all months with 0 good days
    for (let i = 1; i <= 12; i++) {
      const monthName = new Date(selectedYear, i - 1, 1).toLocaleString('default', { month: 'short' });
      monthCounts[i] = {
        month: monthName,
        goodDays: 0,
        totalDays: 0
      };
    }

    // Count good days and total days for each month in the selected year
    history.forEach(record => {
      const date = new Date(record.date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // getMonth() returns 0-11
      
      if (year === selectedYear && monthCounts[month]) {
        monthCounts[month].totalDays++;
        if (record.is_good_day) {
          monthCounts[month].goodDays++;
        }
      }
    });

    // Convert to array format for the chart
    return Object.values(monthCounts);
  }, [history, selectedYear]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium">{`${label} ${selectedYear}`}</p>
          <p className="text-blue-600">{`Good Days: ${data.goodDays}`}</p>
          <p className="text-gray-600">{`Total Days: ${data.totalDays}`}</p>
        </div>
      );
    }
    return null;
  };

  const goToPreviousYear = () => {
    const currentIndex = availableYears.indexOf(selectedYear);
    if (currentIndex > 0) {
      setSelectedYear(availableYears[currentIndex - 1]);
    }
  };

  const goToNextYear = () => {
    const currentIndex = availableYears.indexOf(selectedYear);
    if (currentIndex < availableYears.length - 1) {
      setSelectedYear(availableYears[currentIndex + 1]);
    }
  };

  const canGoPrevious = availableYears.indexOf(selectedYear) > 0;
  const canGoNext = availableYears.indexOf(selectedYear) < availableYears.length - 1;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={goToPreviousYear}
          disabled={!canGoPrevious}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <h3 className="text-lg font-semibold">{selectedYear}</h3>
        
        <Button
          variant="outline"
          size="sm"
          onClick={goToNextYear}
          disabled={!canGoNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={monthlyData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              label={{ value: 'Good Days', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="goodDays" 
              stroke="#22c55e" 
              strokeWidth={2}
              dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MonthlyGoodDaysChart;
