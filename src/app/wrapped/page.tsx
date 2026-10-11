import { notFound, redirect } from "next/navigation";
import { getTodaysNZTDate } from "@/lib/weather";
import { canViewWrapped } from "@/lib/wrapped-release";

// Depends on today's date and the release env var, so never cache it.
export const dynamic = "force-dynamic";

const FIRST_YEAR = 2020;

// /wrapped → the most recent year this deployment may show. On production
// that's the latest released year (404 until one is released); on previews
// and locally it's the current year's draft.
export default function WrappedIndex() {
  const currentYear = Number(getTodaysNZTDate().slice(0, 4));
  for (let year = currentYear; year >= FIRST_YEAR; year--) {
    if (canViewWrapped(year)) redirect(`/wrapped/${year}`);
  }
  notFound();
}
