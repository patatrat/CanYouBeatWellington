import Link from "next/link";
import { Home, HelpCircle, History as HistoryIcon } from "lucide-react";

type Page = "home" | "about" | "history";

interface SiteNavProps {
  current: Page;
  // Home is the only page whose background can switch to a dark special-date
  // gradient (matariki/rugby) — About/History are always light, so this
  // defaults to false and only Home ever passes it through.
  onDark?: boolean;
}

const LINKS: { key: Page; href: string; label: string; Icon: typeof Home }[] = [
  { key: "home", href: "/", label: "Home", Icon: Home },
  { key: "about", href: "/about", label: "Why though?", Icon: HelpCircle },
  { key: "history", href: "/history", label: "The record", Icon: HistoryIcon },
];

// Same pill-button treatment on every page, always linking to the other two
// — plain text links here got missed by a lot of first-time (mostly mobile)
// visitors, so every instance needs to read unambiguously as tappable UI.
const SiteNav = ({ current, onDark = false }: SiteNavProps) => {
  const navButton = onDark
    ? "border-slate-500 bg-slate-800/70 text-slate-100 hover:bg-slate-700"
    : "border-gray-300 bg-white/80 text-gray-700 hover:bg-white hover:border-gray-400";

  return (
    <nav className="flex flex-wrap justify-end gap-3 px-5 pt-5">
      {LINKS.filter((link) => link.key !== current).map(({ key, href, label, Icon }) => (
        <Link
          key={key}
          href={href}
          className={`flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors ${navButton}`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
};

export default SiteNav;
