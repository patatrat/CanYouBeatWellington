
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Filter, Calendar, BarChart3 } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

const fetchHistory = async () => {
  const { data, error } = await supabase
    .from('daily_weather_records')
    .select('*')
    .order('date', { ascending: true });
  
  if (error) throw error;
  return data;
};

const DataExplorer = () => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [groupBy, setGroupBy] = useState('day');
  const [selectedMetrics, setSelectedMetrics] = useState({
    temperature: true,
    wind_speed: true,
    rain: true,
    sunniness: false,
    is_good_day: false
  });

  const { data: history, isLoading, error } = useQuery({
    queryKey: ['history'],
    queryFn: fetchHistory
  });

  const filteredAndGroupedData = useMemo(() => {
    if (!history) return [];

    // Filter by date range
    let filtered = history;
    if (startDate) {
      filtered = filtered.filter(record => new Date(record.date) >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(record => new Date(record.date) <= endDate);
    }

    // Group data based on selected period
    const grouped = {};
    
    filtered.forEach(record => {
      const date = new Date(record.date);
      let key;

      switch (groupBy) {
        case 'day':
          key = record.date;
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = record.date;
      }

      if (!grouped[key]) {
        grouped[key] = {
          period: key,
          records: [],
          temperature: 0,
          wind_speed: 0,
          rain: 0,
          sunniness: 0,
          good_days: 0,
          total_days: 0
        };
      }

      grouped[key].records.push(record);
      grouped[key].total_days++;
      if (record.is_good_day) {
        grouped[key].good_days++;
      }
    });

    // Calculate averages for grouped data
    return Object.values(grouped).map(group => {
      const count = group.records.length;
      return {
        period: group.period,
        temperature: Number((group.records.reduce((sum, r) => sum + r.temperature, 0) / count).toFixed(1)),
        wind_speed: Number((group.records.reduce((sum, r) => sum + r.wind_speed, 0) / count).toFixed(1)),
        rain: Number((group.records.reduce((sum, r) => sum + r.rain, 0) / count).toFixed(1)),
        sunniness: Number((group.records.reduce((sum, r) => sum + r.sunniness, 0) / count).toFixed(1)),
        good_day_percentage: Number(((group.good_days / group.total_days) * 100).toFixed(1)),
        total_days: group.total_days
      };
    }).sort((a, b) => a.period.localeCompare(b.period));
  }, [history, startDate, endDate, groupBy]);

  const handleMetricChange = (metric, checked) => {
    setSelectedMetrics(prev => ({
      ...prev,
      [metric]: checked
    }));
  };

  const formatPeriodLabel = (period) => {
    if (groupBy === 'month') {
      const [year, month] = period.split('-');
      return new Date(year, month - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
    }
    if (groupBy === 'week') {
      return `Week of ${new Date(period).toLocaleDateString()}`;
    }
    return new Date(period).toLocaleDateString();
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium">{formatPeriodLabel(label)}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}${
                entry.dataKey === 'temperature' ? '°C' :
                entry.dataKey === 'wind_speed' ? ' km/h' :
                entry.dataKey === 'rain' ? 'mm' :
                entry.dataKey === 'sunniness' ? '%' :
                entry.dataKey === 'good_day_percentage' ? '%' : ''
              }`}
            </p>
          ))}
          {payload[0]?.payload?.total_days && (
            <p className="text-gray-600 text-sm">
              {groupBy === 'day' ? '1 day' : `${payload[0].payload.total_days} days`}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setGroupBy('day');
    setSelectedMetrics({
      temperature: true,
      wind_speed: true,
      rain: true,
      sunniness: false,
      is_good_day: false
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading data explorer...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-red-500">Error loading data: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-6 h-6" />
              Data Explorer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Date Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <DatePicker
                  date={startDate}
                  onDateChange={setStartDate}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <DatePicker
                  date={endDate}
                  onDateChange={setEndDate}
                  className="w-full"
                />
              </div>

              {/* Group By */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Group By</label>
                <Select value={groupBy} onValueChange={setGroupBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Filters */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Actions</label>
                <Button onClick={clearFilters} variant="outline" className="w-full">
                  <Filter className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </div>

            {/* Metrics Selection */}
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-3">Select Metrics to Display</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(selectedMetrics).map(([metric, checked]) => (
                  <div key={metric} className="flex items-center space-x-2">
                    <Checkbox
                      id={metric}
                      checked={checked}
                      onCheckedChange={(checked) => handleMetricChange(metric, checked)}
                    />
                    <label htmlFor={metric} className="text-sm capitalize">
                      {metric.replace('_', ' ')}
                      {metric === 'is_good_day' && ' %'}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{filteredAndGroupedData.length}</div>
                  <div className="text-sm text-gray-600">Data Points</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">
                    {filteredAndGroupedData.reduce((sum, d) => sum + d.total_days, 0)}
                  </div>
                  <div className="text-sm text-gray-600">Total Days</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">
                    {filteredAndGroupedData.length > 0 
                      ? (filteredAndGroupedData.reduce((sum, d) => sum + d.good_day_percentage * d.total_days, 0) / 
                         filteredAndGroupedData.reduce((sum, d) => sum + d.total_days, 0)).toFixed(1)
                      : 0}%
                  </div>
                  <div className="text-sm text-gray-600">Good Days</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">
                    {filteredAndGroupedData.length > 0 
                      ? (filteredAndGroupedData.reduce((sum, d) => sum + d.temperature * d.total_days, 0) / 
                         filteredAndGroupedData.reduce((sum, d) => sum + d.total_days, 0)).toFixed(1)°C
                      : 0}
                  </div>
                  <div className="text-sm text-gray-600">Avg Temp</div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Weather Data Visualization</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredAndGroupedData.length > 0 ? (
              <div className="w-full h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredAndGroupedData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="period" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={formatPeriodLabel}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    
                    {selectedMetrics.temperature && (
                      <Line 
                        type="monotone" 
                        dataKey="temperature" 
                        stroke="#ef4444" 
                        name="Temperature (°C)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    )}
                    
                    {selectedMetrics.wind_speed && (
                      <Line 
                        type="monotone" 
                        dataKey="wind_speed" 
                        stroke="#3b82f6" 
                        name="Wind Speed (km/h)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    )}
                    
                    {selectedMetrics.rain && (
                      <Line 
                        type="monotone" 
                        dataKey="rain" 
                        stroke="#06b6d4" 
                        name="Rain (mm)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    )}
                    
                    {selectedMetrics.sunniness && (
                      <Line 
                        type="monotone" 
                        dataKey="sunniness" 
                        stroke="#f59e0b" 
                        name="Sunniness (%)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    )}
                    
                    {selectedMetrics.is_good_day && (
                      <Line 
                        type="monotone" 
                        dataKey="good_day_percentage" 
                        stroke="#22c55e" 
                        name="Good Days (%)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-96">
                <p className="text-gray-500">No data available for the selected filters</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DataExplorer;
