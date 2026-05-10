import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getThresholds } from '@/utils/rulesStorage';

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const isGoodDay = (r) => {
  const { minTemp, maxWind, maxRain } = getThresholds(r.date);
  return r.temperature >= minTemp && r.wind_speed < maxWind && r.rain <= maxRain;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d.hasData) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-sm">
      <p className="font-semibold text-gray-800">{label}</p>
      <p className="text-green-600">{d.goodDays} good {d.goodDays === 1 ? 'day' : 'days'}</p>
      <p className="text-gray-400">{d.totalDays} days recorded</p>
    </div>
  );
};

const MonthlyGoodDaysChart = ({ history }) => {
  const today = new Date();
  const [windowEnd, setWindowEnd] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const earliestYM = useMemo(() => {
    if (!history?.length) return null;
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const d = new Date(sorted[0].date);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [history]);

  const startYM = useMemo(() => {
    let m = windowEnd.month - 11;
    let y = windowEnd.year;
    if (m < 0) { m += 12; y--; }
    return { year: y, month: m };
  }, [windowEnd]);

  const canGoPrev = earliestYM && (
    startYM.year > earliestYM.year ||
    (startYM.year === earliestYM.year && startYM.month > earliestYM.month)
  );
  const canGoNext =
    windowEnd.year < today.getFullYear() ||
    (windowEnd.year === today.getFullYear() && windowEnd.month < today.getMonth());

  const shiftWindow = (delta) => {
    setWindowEnd(prev => {
      let m = prev.month + delta;
      let y = prev.year;
      while (m < 0) { m += 12; y--; }
      while (m > 11) { m -= 12; y++; }
      return { year: y, month: m };
    });
  };

  const data = useMemo(() => {
    if (!history) return [];
    const histMap = new Map();
    history.forEach(r => histMap.set(r.date, r));

    const months = [];
    for (let i = 11; i >= 0; i--) {
      let m = windowEnd.month - i;
      let y = windowEnd.year;
      if (m < 0) { m += 12; y--; }

      const mm = String(m + 1).padStart(2, '0');
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      let goodDays = 0, totalDays = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${y}-${mm}-${String(d).padStart(2, '0')}`;
        const r = histMap.get(dateStr);
        if (r) { totalDays++; if (isGoodDay(r)) goodDays++; }
      }

      months.push({
        label: `${MONTH_SHORT[m]} '${String(y).slice(2)}`,
        goodDays,
        totalDays,
        hasData: totalDays > 0,
      });
    }
    return months;
  }, [history, windowEnd]);

  const windowLabel = `${MONTH_SHORT[startYM.month]} ${startYM.year} – ${MONTH_SHORT[windowEnd.month]} ${windowEnd.year}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => shiftWindow(-12)}
          disabled={!canGoPrev}
          className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm text-gray-500">{windowLabel}</span>
        <button
          onClick={() => shiftWindow(12)}
          disabled={!canGoNext}
          className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
          <Bar dataKey="goodDays" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.hasData ? '#22c55e' : '#e5e7eb'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MonthlyGoodDaysChart;
