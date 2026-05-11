import { Check, X } from 'lucide-react';

const WeatherStat = ({ label, value, meets, threshold }) => (
  <div className="text-center flex flex-col items-center gap-1">
    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    <div className="flex items-center gap-1.5">
      <p className="text-lg sm:text-2xl font-bold text-gray-800 whitespace-nowrap">{value}</p>
      {meets ? (
        <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
      ) : (
        <X className="h-5 w-5 text-red-400 flex-shrink-0" />
      )}
    </div>
    {threshold && (
      <p className="text-xs text-gray-400">{threshold}</p>
    )}
  </div>
);

export default WeatherStat;
