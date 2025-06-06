
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const MonthlyGoodDaysChart = ({ history }) => {
  const monthlyData = useMemo(() => {
    if (!history) return [];

    // Group data by month and count good days
    const monthCounts = {};
    
    // Initialize all months with 0 good days
    for (let i = 1; i <= 12; i++) {
      const monthName = new Date(2024, i - 1, 1).toLocaleString('default', { month: 'short' });
      monthCounts[i] = {
        month: monthName,
        goodDays: 0,
        totalDays: 0
      };
    }

    // Count good days and total days for each month
    history.forEach(record => {
      const date = new Date(record.date);
      const month = date.getMonth() + 1; // getMonth() returns 0-11
      
      if (monthCounts[month]) {
        monthCounts[month].totalDays++;
        if (record.is_good_day) {
          monthCounts[month].goodDays++;
        }
      }
    });

    // Convert to array format for the chart
    return Object.values(monthCounts);
  }, [history]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium">{`${label}`}</p>
          <p className="text-blue-600">{`Good Days: ${data.goodDays}`}</p>
          <p className="text-gray-600">{`Total Days: ${data.totalDays}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
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
  );
};

export default MonthlyGoodDaysChart;
