import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getThresholds } from '@/utils/rulesStorage';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Season colour per month index — matches SeasonBreakdown palette
const MONTH_SEASON_COLORS = [
  '#f59e0b', // Jan — Summer
  '#f59e0b', // Feb — Summer
  '#f59e0b', // Mar — Summer
  '#fb923c', // Apr — Autumn
  '#fb923c', // May — Autumn
  '#fb923c', // Jun — Autumn
  '#60a5fa', // Jul — Winter
  '#60a5fa', // Aug — Winter
  '#34d399', // Sep — Spring 1
  '#94a3b8', // Oct — Shitsville
  '#94a3b8', // Nov — Shitsville
  '#a78bfa', // Dec — Spring 2
];

const SeasonTick = ({ x, y, payload, index }) => (
  <g transform={`translate(${x},${y})`}>
    <text x={0} y={0} dy={12} textAnchor="middle" fontSize={11} fill="#9ca3af">
      {payload.value}
    </text>
    <rect
      x={-10} y={17} width={20} height={6} rx={2}
      fill={MONTH_SEASON_COLORS[index]} opacity={0.8}
    />
  </g>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-sm">
      <p className="font-semibold text-gray-800">{label}</p>
      <p className="text-green-600">{d.pct}% good days</p>
      <p className="text-gray-400">{d.good} of {d.total} days across all years</p>
    </div>
  );
};

const barColor = (pct) => {
  if (pct >= 25) return '#16a34a';
  if (pct >= 15) return '#22c55e';
  if (pct >= 8)  return '#86efac';
  return '#dcfce7';
};

const MonthlyAveragesChart = ({ history }) => {
  const data = useMemo(() => {
    if (!history) return [];
    const months = Array.from({ length: 12 }, () => ({ good: 0, total: 0 }));
    history.forEach(r => {
      const m = new Date(r.date).getMonth();
      const { minTemp, maxWind, maxRain } = getThresholds(r.date);
      const good = r.temperature >= minTemp && r.wind_speed < maxWind && r.rain <= maxRain;
      months[m].total++;
      if (good) months[m].good++;
    });
    return months.map((m, i) => ({
      month: MONTHS[i],
      pct: m.total > 0 ? Math.round((m.good / m.total) * 100) : 0,
      good: m.good,
      total: m.total,
    }));
  }, [history]);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="month"
          tick={<SeasonTick />}
          axisLine={false}
          tickLine={false}
          height={38}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
          domain={[0, 20]} tickFormatter={v => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
        <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={barColor(entry.pct)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default MonthlyAveragesChart;
