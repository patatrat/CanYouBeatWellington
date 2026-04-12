import { useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { loadRules } from '@/utils/rulesStorage';

const W = 560;
const H = 260;
const PAD = { top: 20, right: 20, bottom: 36, left: 40 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

const MonthlyGoodDaysChart = ({ history }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [tooltip, setTooltip] = useState(null);

  const availableYears = useMemo(() => {
    if (!history) return [];
    const years = new Set(history.map(r => new Date(r.date).getFullYear()));
    return Array.from(years).sort((a, b) => a - b);
  }, [history]);

  const monthlyData = useMemo(() => {
    if (!history) return [];
    const rules = loadRules();
    const isGoodDay = (r) => r.temperature >= rules.minTemp && r.wind_speed < rules.maxWind && r.rain <= rules.maxRain;

    const counts = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(selectedYear, i, 1).toLocaleString('default', { month: 'short' }),
      goodDays: 0,
      totalDays: 0,
    }));

    history.forEach(r => {
      const d = new Date(r.date);
      if (d.getFullYear() === selectedYear) {
        const m = d.getMonth();
        counts[m].totalDays++;
        if (isGoodDay(r)) counts[m].goodDays++;
      }
    });

    return counts;
  }, [history, selectedYear]);

  const canGoPrev = availableYears.indexOf(selectedYear) > 0;
  const canGoNext = availableYears.indexOf(selectedYear) < availableYears.length - 1;

  const yMax = Math.max(Math.ceil(Math.max(...monthlyData.map(d => d.goodDays)) / 5) * 5, 5);
  const yTicks = [0, Math.round(yMax / 2), yMax];

  const getX = (i) => PAD.left + (i / 11) * CW;
  const getY = (v) => PAD.top + CH - (v / yMax) * CH;

  const pathD = monthlyData
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${getX(i).toFixed(1)},${getY(d.goodDays).toFixed(1)}`)
    .join(' ');

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="sm" onClick={() => setSelectedYear(availableYears[availableYears.indexOf(selectedYear) - 1])} disabled={!canGoPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold">{selectedYear}</h3>
        <Button variant="outline" size="sm" onClick={() => setSelectedYear(availableYears[availableYears.indexOf(selectedYear) + 1])} disabled={!canGoNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {/* Grid lines + Y-axis labels */}
          {yTicks.map(tick => (
            <g key={tick}>
              <line x1={PAD.left} x2={W - PAD.right} y1={getY(tick)} y2={getY(tick)} stroke="#e5e7eb" strokeDasharray="3 3" />
              <text x={PAD.left - 6} y={getY(tick) + 4} textAnchor="end" fontSize="11" fill="#9ca3af">{tick}</text>
            </g>
          ))}

          {/* Y-axis label */}
          <text x={12} y={H / 2} textAnchor="middle" fontSize="11" fill="#9ca3af" transform={`rotate(-90,12,${H / 2})`}>Good Days</text>

          {/* Line */}
          <path d={pathD} fill="none" stroke="#22c55e" strokeWidth="2" />

          {/* Dots + X-axis labels */}
          {monthlyData.map((d, i) => (
            <g key={i}>
              <text x={getX(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#9ca3af">{d.month}</text>
              <circle
                cx={getX(i)} cy={getY(d.goodDays)} r="5" fill="#22c55e"
                className="cursor-pointer"
                onMouseEnter={() => setTooltip({ i, data: d })}
                onMouseLeave={() => setTooltip(null)}
              />
              {/* Larger invisible hit area */}
              <circle cx={getX(i)} cy={getY(d.goodDays)} r="12" fill="transparent"
                onMouseEnter={() => setTooltip({ i, data: d })}
                onMouseLeave={() => setTooltip(null)}
              />
              {/* SVG tooltip */}
              {tooltip?.i === i && (
                <g transform={`translate(${getX(i)},${getY(d.goodDays) - 14})`}>
                  <rect x="-52" y="-46" width="104" height="44" fill="white" stroke="#e5e7eb" strokeWidth="1" rx="4" />
                  <text x="0" y="-29" textAnchor="middle" fontSize="12" fontWeight="600" fill="#111827">{d.month} {selectedYear}</text>
                  <text x="0" y="-14" textAnchor="middle" fontSize="11" fill="#2563eb">Good Days: {d.goodDays}</text>
                  <text x="0" y="-2" textAnchor="middle" fontSize="11" fill="#6b7280">Total Days: {d.totalDays}</text>
                </g>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};

export default MonthlyGoodDaysChart;
