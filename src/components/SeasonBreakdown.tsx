"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { getThresholds, getSeasonLabel } from "@/utils/rulesStorage";
import type { DailyWeatherRecord } from "@/types/db";

const SEASON_COLORS: Record<string, string> = {
  Summer: "#f59e0b",
  "Spring 2": "#a78bfa",
  "Spring 1": "#34d399",
  Autumn: "#fb923c",
  Shitsville: "#94a3b8",
  Winter: "#60a5fa",
};

const SEASON_ORDER = ["Summer", "Autumn", "Winter", "Spring 1", "Shitsville", "Spring 2"];

interface SeasonDatum {
  name: string;
  pct: number;
  good: number;
  total: number;
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: SeasonDatum }[] }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-sm">
      <p className="font-semibold text-gray-800">{d.name}</p>
      <p style={{ color: SEASON_COLORS[d.name] ?? "#22c55e" }}>{d.pct}% good days</p>
      <p className="text-gray-400">{d.good} of {d.total} days</p>
    </div>
  );
};

interface SeasonBreakdownProps {
  history: DailyWeatherRecord[];
}

const SeasonBreakdown = ({ history }: SeasonBreakdownProps) => {
  const data = useMemo<SeasonDatum[]>(() => {
    if (!history) return [];
    const acc: Record<string, { good: number; total: number }> = {};
    history.forEach((r) => {
      const date = new Date(r.date);
      const season = getSeasonLabel(date);
      const { minTemp, maxWind, maxRain } = getThresholds(date);
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

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 72 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 20]}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 12, fill: "#374151" }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f9fafb" }} />
        <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={SEASON_COLORS[entry.name] ?? "#22c55e"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default SeasonBreakdown;
