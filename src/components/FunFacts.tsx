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
// Used twice on /history: the fun facts and their gloomy twin, side by side.
const FunFacts = ({ title, facts }: { title: string; facts: FunFact[] }) => {
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
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        {facts.length > 1 && (
          <button
            type="button"
            onClick={another}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white/60 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-white"
          >
            <Shuffle className="h-3.5 w-3.5" aria-hidden /> Another fact
          </button>
        )}
      </div>
      <div className={`transition-opacity duration-300 motion-reduce:transition-none ${ready ? "opacity-100" : "opacity-0"}`} aria-live="polite">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">{fact.scope}</p>
        <p className="text-lg font-bold text-gray-800">{fact.text}</p>
      </div>
    </div>
  );
};

export default FunFacts;
