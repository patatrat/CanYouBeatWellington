import { calculateFunFacts, getRandomFunFact } from "@/utils/weatherFunFacts";
import type { DailyWeatherRecord } from "@/types/db";

interface FunFactsProps {
  history: DailyWeatherRecord[];
}

// Server-rendered: picking the fact at request time (rather than on the
// client) avoids a hydration mismatch from Math.random() running twice.
const FunFacts = ({ history }: FunFactsProps) => {
  const randomFact = history ? getRandomFunFact(calculateFunFacts(history)) : null;

  if (!randomFact) return null;

  return (
    <div className="text-center py-6 px-4 rounded-xl bg-white/60 border border-gray-100">
      <p className="text-lg font-medium text-gray-700 italic">&ldquo;{randomFact}&rdquo;</p>
      <p className="text-xs text-gray-400 mt-2">Refresh to see another fact</p>
    </div>
  );
};

export default FunFacts;
