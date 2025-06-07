
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb } from 'lucide-react';
import { calculateFunFacts, getRandomFunFact } from '../utils/weatherFunFacts';

const FunFacts = ({ history }) => {
  const randomFact = useMemo(() => {
    if (!history) return null;
    
    const facts = calculateFunFacts(history);
    return getRandomFunFact(facts);
  }, [history]);

  if (!randomFact) {
    return null;
  }

  return (
    <Card className="w-full max-w-2xl mb-8">
      <CardHeader>
        <CardTitle className="text-center flex items-center justify-center gap-2">
          <Lightbulb className="w-6 h-6 text-yellow-500" />
          <h2 className="text-2xl font-bold">Wellington Weather Fun Fact</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-lg text-center font-medium text-gray-700 italic">
          "{randomFact}"
        </p>
        <p className="text-sm text-center text-gray-500 mt-2">
          Refresh the page to see another fun fact!
        </p>
      </CardContent>
    </Card>
  );
};

export default FunFacts;
