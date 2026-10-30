"use client";

import { useEffect, useState } from "react";
import { Shuffle } from "lucide-react";
import type { FunFact } from "@/utils/weatherFunFacts";

// The History page is cached for an hour, so a fact picked on the server
// would be the same for everyone until it rebuilt. Instead the server sends
// every fact and the browser picks: a random one on load, then a new one
// each time the button is pressed.
//
// The first fact is rendered invisible until the random pick is made, so
// there's no flash of fact 0 and no hydration mismatch from Math.random().
const FunFacts = ({ facts }: { facts: FunFact[] }) => {
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Runs once in the browser; picking here rather than during render
    // keeps the server and client HTML identical.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndex(Math.floor(Math.random() * facts.length));
    setReady(true);
  }, [facts.length]);

  if (facts.length === 0) return null;
  const fact = facts[index];

  const another = () => {
    if (facts.length < 2) return;
    let next = index;
    while (next === index) next = Math.floor(Math.random() * facts.length);
    setIndex(next);
  };

  return (
    <div className="text-center py-6 px-4 rounded-xl bg-white/60 border border-gray-100">
      <div className={`transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{fact.scope}</p>
        <p className="text-lg font-medium text-gray-700">{fact.text}</p>
      </div>
      {facts.length > 1 && (
        <button
          type="button"
          onClick={another}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-white hover:border-gray-400"
        >
          <Shuffle className="h-3.5 w-3.5" /> Another fact
        </button>
      )}
    </div>
  );
};

export default FunFacts;
