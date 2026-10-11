// Minimal horizontal bar chart for the Wrapped page's coloured cards —
// hand-rolled SVG so it renders server-side with no client JS. Single
// series, so no legend: the card heading names it and every bar carries a
// direct value label. Each bar's <title> gives a native hover tooltip, and
// a visually hidden table carries the same data for screen readers.

export interface WrappedBar {
  label: string;
  value: number;
  valueLabel: string;
  tooltip: string;
  // Dimmed bars (e.g. wind bins above the good-day limit) — still labelled,
  // so the distinction never rests on opacity alone.
  muted?: boolean;
}

interface WrappedBarChartProps {
  bars: WrappedBar[];
  caption: string;
  // Optional vertical marker between two categories, e.g. the 30 km/h
  // good-day wind limit. Drawn after bar `afterIndex`.
  marker?: { afterIndex: number; label: string };
}

const ROW = 30;
const BAR = 20;
const LABEL_W = 84;
const VALUE_W = 36;
// A narrow coordinate system so 13px labels stay ~11px+ at phone width;
// capped with max-w on desktop so they don't balloon either.
const WIDTH = 320;

export default function WrappedBarChart({ bars, caption, marker }: WrappedBarChartProps) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const plotW = WIDTH - LABEL_W - VALUE_W;
  const markerGap = marker ? 30 : 0;
  const height = bars.length * ROW + markerGap;
  const yFor = (i: number) => i * ROW + (marker && i > marker.afterIndex ? markerGap : 0);

  return (
    <figure className="w-full max-w-md">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label={caption}
      >
        {bars.map((bar, i) => {
          const y = yFor(i);
          const w = Math.max(bar.value > 0 ? 4 : 0, (bar.value / max) * plotW);
          return (
            <g key={bar.label}>
              <title>{bar.tooltip}</title>
              {/* Invisible full-row hit target, bigger than the mark. */}
              <rect x={0} y={y} width={WIDTH} height={ROW} fill="transparent" />
              <text x={LABEL_W - 10} y={y + BAR / 2 + 5} textAnchor="end" fontSize="13" fill="currentColor" fontWeight={600}>
                {bar.label}
              </text>
              <rect
                x={LABEL_W}
                y={y}
                width={w}
                height={BAR}
                rx={4}
                fill="currentColor"
                fillOpacity={bar.muted ? 0.4 : 0.92}
              />
              <text x={LABEL_W + w + 8} y={y + BAR / 2 + 5} fontSize="13" fill="currentColor" fontWeight={700}>
                {bar.valueLabel}
              </text>
            </g>
          );
        })}
        {marker ? (
          <g>
            <line
              x1={LABEL_W - 4}
              x2={WIDTH}
              y1={yFor(marker.afterIndex) + ROW - 2}
              y2={yFor(marker.afterIndex) + ROW - 2}
              stroke="currentColor"
              strokeOpacity={0.6}
              strokeDasharray="4 4"
            />
            <text
              x={LABEL_W}
              y={yFor(marker.afterIndex) + ROW + 12}
              fontSize="11"
              fill="currentColor"
              fillOpacity={0.85}
            >
              {marker.label}
            </text>
          </g>
        ) : null}
      </svg>
      <figcaption className="sr-only">{caption}</figcaption>
      <table className="sr-only">
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.label}>
              <th scope="row">{bar.label}</th>
              <td>{bar.tooltip}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
