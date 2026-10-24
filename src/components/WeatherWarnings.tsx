import { AlertTriangle, ExternalLink } from "lucide-react";
import { formatNZTime, type WeatherWarning } from "@/lib/weather-warnings";

// MetService watches/warnings covering Wellington. Its own white card so it
// stays readable on every home page background, special-date ones included.
// The colour bar uses MetService's own colour code for the alert.
const WeatherWarnings = ({ warnings }: { warnings: WeatherWarning[] }) => {
  if (warnings.length === 0) return null;

  return (
    <section aria-label="Severe weather warnings" className="w-full max-w-md mb-6 space-y-3">
      {warnings.map((w) => (
        <div
          key={w.id}
          className="rounded-lg border border-gray-200 bg-white/95 text-left text-gray-800 shadow-sm overflow-hidden"
          style={{ borderLeft: `6px solid ${w.colour}` }}
        >
          <div className="px-4 py-3 space-y-1.5">
            <p className="flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: w.colour }} aria-hidden="true" />
              {w.headline}
            </p>
            <p className="text-xs font-medium text-gray-500">
              {w.onset ? `${formatNZTime(w.onset)} – ${formatNZTime(w.expires)}` : `Until ${formatNZTime(w.expires)}`}
            </p>
            <p className="text-sm">{w.description}</p>
            {w.instruction && <p className="text-sm">{w.instruction}</p>}
            <p className="text-xs text-gray-500 pt-1">
              <a href={w.web} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-gray-800">
                MetService <ExternalLink className="inline-block h-3 w-3" />
              </a>
              {" · "}
              <a href="https://getready.govt.nz/" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-gray-800">
                Preparedness advice from NEMA <ExternalLink className="inline-block h-3 w-3" />
              </a>
            </p>
          </div>
        </div>
      ))}
      <p className="text-[10px] text-gray-400 text-center">
        Warning data © MetService, licensed CC BY 4.0.
      </p>
    </section>
  );
};

export default WeatherWarnings;
