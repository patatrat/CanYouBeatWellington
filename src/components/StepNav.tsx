import { ChevronLeft, ChevronRight } from "lucide-react";

// Previous/next stepper shared by the History panels (year, month, 12-month
// window), so every panel navigates the same way however many years build up.
export default function StepNav({
  label,
  onPrev,
  onNext,
  canPrev = true,
  canNext = true,
  prevLabel = "Previous",
  nextLabel = "Next",
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  prevLabel?: string;
  nextLabel?: string;
}) {
  const button = "rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent";
  return (
    <div className="inline-flex items-center gap-1 text-sm">
      <button type="button" onClick={onPrev} disabled={!canPrev} aria-label={prevLabel} className={button}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[4.5rem] text-center font-medium tabular-nums text-gray-700" aria-live="polite">{label}</span>
      <button type="button" onClick={onNext} disabled={!canNext} aria-label={nextLabel} className={button}>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
