// The dark tooltip used across the History charts, matching the year grid's.
export default function ChartTooltip({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-md bg-gray-900 px-2.5 py-2 text-xs text-white shadow-lg">
      <p className="font-semibold">{title}</p>
      {lines.map((line) => (
        <p key={line} className="text-gray-300">{line}</p>
      ))}
    </div>
  );
}
