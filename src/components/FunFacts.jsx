import { useMemo } from 'react';
import { calculateFunFacts, getRandomFunFact } from '../utils/weatherFunFacts';

const FunFacts = ({ history }) => {
  const randomFact = useMemo(() => {
    if (!history) return null;
    const facts = calculateFunFacts(history);
    return getRandomFunFact(facts);
  }, [history]);

  if (!randomFact) return null;

  return (
    <div className="text-center py-6 px-4 rounded-xl bg-white/60 border border-gray-100">
      <p className="text-lg font-medium text-gray-700 italic">&ldquo;{randomFact}&rdquo;</p>
      <p className="text-xs text-gray-400 mt-2">Refresh to see another fact</p>
    </div>
  );
};

export default FunFacts;
