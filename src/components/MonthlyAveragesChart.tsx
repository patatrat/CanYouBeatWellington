"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { getSeasonLabel, getThresholds } from "@/utils/rulesStorage";
import type { DailyWeatherRecord } from "@/types/db";
import { CHART, SEASON_COLOURS } from "@/utils/chartTheme";
import ChartTooltip from "./ChartTooltip";
import PanelHeader from "./PanelHeader";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface MonthDatum {
  month: string;
  season: string;
  pct: number;
  good: number;
  total: number;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { payload: MonthDatum }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <ChartTooltip
      title={`${label} · ${d.season}`}
      lines={[`${d.pct}% good days`, `${d.good} of ${d.total} days across all years`]}
    />
  );
};

interface MonthlyAveragesChartProps {
  history: DailyWeatherRecord[];
}

const MonthlyAveragesChart = ({ history }: MonthlyAveragesChartProps) => {
  const data = useMemo<MonthDatum[]>(() => {
    if (!history) return [];
    const months = Array.from({ length: 12 }, () => ({ good: 0, total: 0 }));
    history.forEach((r) => {
      // Dates are YYYY-MM-DD; read the month from the string so the
      // visitor's timezone can't shift a day into the wrong month.
      const m = Number(r.date.slice(5, 7)) - 1;
      const { minTemp, maxWind, maxRain } = getThresholds(r.date);
      const good = r.temperature >= minTemp && r.wind_speed < maxWind && r.rain <= maxRain;
      months[m].total++;
      if (good) months[m].good++;
    });
    return months.map((m, i) => ({
      month: MONTHS[i],
      season: getSeasonLabel(`2001-${String(i + 1).padStart(2, "0")}-01`),
      pct: m.total > 0 ? Math.round((m.good / m.total) * 100) : 0,
      good: m.good,
      total: m.total,
    }));
  }, [history]);

  const best = data.reduce<MonthDatum | null>((top, d) => (d.total && (!top || d.pct > top.pct) ? d : top), null);

  return (
    <div>
      {best ? (
        <PanelHeader title={`${MONTH_NAMES[MONTHS.indexOf(best.month)]} delivers most often: ${best.pct}% good days`} />
      ) : null}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: CHART.axis }}
            axisLine={false}
            tickLine={false}
            domain={[0, (max: number) => Math.max(10, Math.ceil(max / 5) * 5)]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: CHART.cursor }} />
          <Bar dataKey="pct" radius={[2, 2, 0, 0]} maxBarSize={28}>
            {data.map((d) => (
              <Cell key={d.month} fill={SEASON_COLOURS[d.season] ?? CHART.good} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Bars are coloured by season, so name each colour. */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500">
        {[...new Set(data.map((d) => d.season))].map((season) => (
          <span key={season} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-[11px] w-[11px] rounded-sm" style={{ background: SEASON_COLOURS[season] }} />
            {season}
          </span>
        ))}
      </div>
    </div>
  );
};

export default MonthlyAveragesChart;
