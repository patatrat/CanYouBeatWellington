// Shared colours for the History page's charts, so the year grid, bar
// charts and month calendar read as one set. Good days are always the same
// green; everything else is a slate neutral.
export const CHART = {
  good: "#22a356",
  goodText: "#15803d",
  neutral: "#e3e8ed",
  grid: "#e2e8f0",
  axis: "#64748b",
  cursor: "#f1f5f9",
} as const;

// One colour per season, used wherever a chart is split by season. Late
// Autumn is a deeper shade of Autumn's orange; Shitsville is suitably grey.
export const SEASON_COLOURS: Record<string, string> = {
  Summer: "#f59e0b",
  Autumn: "#fb923c",
  "Late Autumn": "#ea580c",
  Winter: "#60a5fa",
  "Spring 1": "#34d399",
  Shitsville: "#94a3b8",
  "Spring 2": "#a78bfa",
};
