"use client";

import { useEffect } from "react";
import type { EffectType } from "@/lib/special-dates";

interface SpecialDateEffectProps {
  effect: EffectType;
}

const SpecialDateEffect = ({ effect }: SpecialDateEffectProps) => {
  useEffect(() => {
    if (effect !== "confetti") return;
    // Dynamically imported so its ~6kb only loads into the bundle on the
    // (rare) days an effect actually fires — zero cost on ordinary days.
    import("canvas-confetti").then(({ default: confetti }) => {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.3 } });
    });
  }, [effect]);

  if (effect !== "balloons") return null;

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-50" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <span
          key={i}
          className="balloon absolute bottom-[-10%] text-5xl"
          style={{ left: `${(i + 1) * 11}%`, animationDelay: `${i * 0.6}s` }}
        >
          🎈
        </span>
      ))}
    </div>
  );
};

export default SpecialDateEffect;
