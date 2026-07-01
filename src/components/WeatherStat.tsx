import { Check, X } from "lucide-react";

interface WeatherStatProps {
  label: string;
  value: string;
  meets: boolean;
  threshold?: string;
  // Rendered on a dark special background (matariki, rugby) — swap the
  // gray-on-light text for light variants.
  onDark?: boolean;
}

const WeatherStat = ({ label, value, meets, threshold, onDark = false }: WeatherStatProps) => (
  <div className="text-center flex flex-col items-center gap-1">
    <p className={`text-xs font-semibold uppercase tracking-widest ${onDark ? "text-slate-400" : "text-gray-400"}`}>{label}</p>
    <div className="flex items-center gap-1.5">
      <p className={`text-lg sm:text-2xl font-bold whitespace-nowrap ${onDark ? "text-slate-100" : "text-gray-800"}`}>{value}</p>
      {meets ? (
        <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
      ) : (
        <X className="h-5 w-5 text-red-400 flex-shrink-0" />
      )}
    </div>
    {threshold && <p className={`text-xs ${onDark ? "text-slate-400" : "text-gray-400"}`}>{threshold}</p>}
  </div>
);

export default WeatherStat;
