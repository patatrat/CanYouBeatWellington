"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { getThresholds } from "@/utils/rulesStorage";
import type { DailyWeatherRecord } from "@/types/db";
import { CHART } from "@/utils/chartTheme";
import ChartTooltip from "./ChartTooltip";
import PanelHeader from "./PanelHeader";
import StepNav from "./StepNav";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface MonthDatum {
  label: string;
  goodDays: number;
  totalDays: number;
  hasData: boolean;
}

const isGoodDay = (r: DailyWeatherRecord) => {
  const { minTemp, maxWind, maxRain } = getThresholds(r.date);
  return r.temperature >= minTemp && r.wind_speed < maxWind && r.rain <= maxRain;
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { payload: MonthDatum }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d.hasData) return null;
  return (
    <ChartTooltip
      title={label ?? ""}
      lines={[`${d.goodDays} good ${d.goodDays === 1 ? "day" : "days"}`, `${d.totalDays} days recorded`]}
    />
  );
};

interface YearMonth {
  year: number;
  month: number;
}

interface MonthlyGoodDaysChartProps {
  history: DailyWeatherRecord[];
}

const MonthlyGoodDaysChart = ({ history }: MonthlyGoodDaysChartProps) => {
  const today = new Date();
  const [windowEnd, setWindowEnd] = useState<YearMonth>({ year: today.getFullYear(), month: today.getMonth() });

  const earliestYM = useMemo<YearMonth | null>(() => {
    if (!history?.length) return null;
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const d = new Date(sorted[0].date);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [history]);

  const startYM = useMemo<YearMonth>(() => {
    let m = windowEnd.month - 11;
    let y = windowEnd.year;
    if (m < 0) {
      m += 12;
      y--;
    }
    return { year: y, month: m };
  }, [windowEnd]);

  const canGoPrev = !!earliestYM && (
    startYM.year > earliestYM.year ||
    (startYM.year === earliestYM.year && startYM.month > earliestYM.month)
  );
  const canGoNext =
    windowEnd.year < today.getFullYear() ||
    (windowEnd.year === today.getFullYear() && windowEnd.month < today.getMonth());

  const shiftWindow = (delta: number) => {
    setWindowEnd((prev) => {
      let m = prev.month + delta;
      let y = prev.year;
      while (m < 0) {
        m += 12;
        y--;
      }
      while (m > 11) {
        m -= 12;
        y++;
      }
      return { year: y, month: m };
    });
  };

  const data = useMemo<MonthDatum[]>(() => {
    if (!history) return [];
    const histMap = new Map<string, DailyWeatherRecord>();
    history.forEach((r) => histMap.set(r.date, r));

    const months: MonthDatum[] = [];
    for (let i = 11; i >= 0; i--) {
      let m = windowEnd.month - i;
      let y = windowEnd.year;
      if (m < 0) {
        m += 12;
        y--;
      }

      const mm = String(m + 1).padStart(2, "0");
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      let goodDays = 0;
      let totalDays = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${y}-${mm}-${String(d).padStart(2, "0")}`;
        const r = histMap.get(dateStr);
        if (r) {
          totalDays++;
          if (isGoodDay(r)) goodDays++;
        }
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

  const windowLabel = `${MONTH_SHORT[startYM.month]} '${String(startYM.year).slice(2)} – ${MONTH_SHORT[windowEnd.month]} '${String(windowEnd.year).slice(2)}`;
  const totalGood = data.reduce((sum, d) => sum + d.goodDays, 0);
  const title = canGoNext
    ? `${totalGood} good ${totalGood === 1 ? "day" : "days"}, ${windowLabel}`
    : `${totalGood} good ${totalGood === 1 ? "day" : "days"} in the last 12 months`;

  return (
    <div>
      <PanelHeader title={title}>
        <StepNav
          label={windowLabel}
          onPrev={() => shiftWindow(-12)}
          onNext={() => shiftWindow(12)}
          canPrev={canGoPrev}
          canNext={canGoNext}
          prevLabel="Previous 12 months"
          nextLabel="Next 12 months"
        />
      </PanelHeader>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: CHART.cursor }} />
          <Bar dataKey="goodDays" radius={[2, 2, 0, 0]} maxBarSize={28}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.hasData ? CHART.good : CHART.neutral} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MonthlyGoodDaysChart;
