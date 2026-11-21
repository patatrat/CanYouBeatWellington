"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { getThresholds, getSeasonLabel } from "@/utils/rulesStorage";
import type { DailyWeatherRecord } from "@/types/db";
import { CHART } from "@/utils/chartTheme";
import ChartTooltip from "./ChartTooltip";
import PanelHeader from "./PanelHeader";

// Calendar order. Every label getSeasonLabel() can return must be here, or
// that season's days silently drop out of the chart.
const SEASON_ORDER = ["Summer", "Autumn", "Late Autumn", "Winter", "Spring 1", "Shitsville", "Spring 2"];

interface SeasonDatum {
  name: string;
  pct: number;
  good: number;
  total: number;
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: SeasonDatum }[] }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return <ChartTooltip title={d.name} lines={[`${d.pct}% good days`, `${d.good} of ${d.total} days`]} />;
};

interface SeasonBreakdownProps {
  history: DailyWeatherRecord[];
}

const SeasonBreakdown = ({ history }: SeasonBreakdownProps) => {
  const data = useMemo<SeasonDatum[]>(() => {
    if (!history) return [];
    const acc: Record<string, { good: number; total: number }> = {};
    history.forEach((r) => {
      const season = getSeasonLabel(r.date);
      const { minTemp, maxWind, maxRain } = getThresholds(r.date);
      const good = r.temperature >= minTemp && r.wind_speed < maxWind && r.rain <= maxRain;
      if (!acc[season]) acc[season] = { good: 0, total: 0 };
      acc[season].total++;
      if (good) acc[season].good++;
    });

    return SEASON_ORDER.filter((s) => acc[s]).map((s) => ({
      name: s,
      pct: Math.round((acc[s].good / acc[s].total) * 100),
      good: acc[s].good,
      total: acc[s].total,
    }));
  }, [history]);

  const best = data.reduce<SeasonDatum | null>((top, d) => (!top || d.pct > top.pct ? d : top), null);

  return (
    <div>
      {best ? <PanelHeader title={`${best.name} has the best odds: ${best.pct}% good days`} /> : null}
      <ResponsiveContainer width="100%" height={data.length * 34 + 24}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHART.grid} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, (max: number) => Math.max(10, Math.ceil(max / 5) * 5)]}
            tick={{ fontSize: 11, fill: CHART.axis }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis type="category" dataKey="name" width={84} tick={{ fontSize: 12, fill: "#374151" }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: CHART.cursor }} />
          <Bar dataKey="pct" fill={CHART.good} radius={[0, 2, 2, 0]} maxBarSize={18}>
            <LabelList dataKey="pct" position="right" formatter={(v) => `${v}%`} style={{ fontSize: 11, fill: CHART.axis }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SeasonBreakdown;
