import { AlertTriangle, ChevronDown, ExternalLink } from "lucide-react";
import { formatNZTime, type WeatherWarning } from "@/lib/weather-warnings";

// MetService watches/warnings covering Wellington. Its own white card so it
// stays readable on every home page background, special-date ones included.
// The colour bar uses MetService's own colour code for the alert.
//
// Collapsed by default to the headline and time window; a native <details>
// expands it to the full text, so this stays a server component with no
// client JS.
const WeatherWarnings = ({ warnings }: { warnings: WeatherWarning[] }) => {
  if (warnings.length === 0) return null;

  return (
    <section aria-label="Severe weather warnings" className="w-full max-w-md md:max-w-2xl mb-6 space-y-2">
      {warnings.map((w) => (
        <details
          key={w.id}
          className="group rounded-lg border border-gray-200 bg-white/95 text-left text-gray-800 shadow-sm overflow-hidden"
          style={{ borderLeft: `6px solid ${w.colour}` }}
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
            <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: w.colour }} aria-hidden="true" />
            <span className="flex flex-1 flex-col md:flex-row md:items-baseline md:gap-3">
              <span className="font-bold">{w.headline}</span>
              <span className="text-xs font-medium text-gray-500">
                {w.onset ? `${formatNZTime(w.onset)} – ${formatNZTime(w.expires)}` : `Until ${formatNZTime(w.expires)}`}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="px-4 pb-3 space-y-1.5">
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
        </details>
      ))}
      <p className="text-[10px] text-gray-400 text-center">
        Warning data © MetService, licensed CC BY 4.0.
      </p>
    </section>
  );
};

export default WeatherWarnings;
