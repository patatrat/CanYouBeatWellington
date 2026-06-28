import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Why though? — Can You Beat Wellington?",
};

const SEASONS = [
  { season: "Summer", months: "Jan, Feb, Mar", temp: "19°C", wind: "30 km/h", rain: "0 mm" },
  { season: "Autumn", months: "Apr, May, Jun", temp: "16°C", wind: "30 km/h", rain: "0 mm" },
  { season: "Winter", months: "Jul, Aug", temp: "13°C", wind: "30 km/h", rain: "0 mm" },
  { season: "Spring 1", months: "Sep", temp: "14°C", wind: "30 km/h", rain: "0 mm" },
  { season: "Shitsville", months: "Oct, Nov", temp: "16°C", wind: "30 km/h", rain: "0 mm" },
  { season: "Spring 2", months: "Dec", temp: "18°C", wind: "30 km/h", rain: "0 mm" },
];

export default function AboutPage() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100">
      <nav className="absolute top-4 right-5 flex gap-5 text-sm font-medium text-gray-500">
        <Link href="/" className="hover:text-gray-800 transition-colors">Today</Link>
        <Link href="/history" className="hover:text-gray-800 transition-colors">The record</Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-16">
        <header className="text-center mb-14">
          <h1 className="text-4xl font-black text-gray-800 mb-2">Why though?</h1>
          <p className="text-gray-500">Wellington&apos;s most famous weather claim, put on trial.</p>
        </header>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <p>
            {`"You can't beat Wellington on a good day" — Wellington's most famous weather saying.
            But how often is it actually true?`}
          </p>
          <p>
            Every day, real weather data for Wellington is fetched and checked against three conditions.
            If all three pass, it&apos;s a good day. If not — well. Wellington.
          </p>

          <h2 className="text-xl font-bold text-gray-800 pt-4">The rules</h2>
          <p>
            Wellington has six seasons, not four — at least according to the locals. The app uses seasonal
            temperature thresholds based on{" "}
            <a href="https://adam.nz/realistic-calendar" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:text-amber-900 underline underline-offset-2">
              Adam Shand&apos;s Shitsville calendar <ExternalLink className="inline-block w-3.5 h-3.5 ml-0.5" />
            </a>
            , calibrated against six years of actual Wellington weather data. Read the full story behind
            the rule change on{" "}
            <a href="https://radomski.co.nz/blog/shitsville" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:text-amber-900 underline underline-offset-2">
              the blog <ExternalLink className="inline-block w-3.5 h-3.5 ml-0.5" />
            </a>.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-amber-200">
                  <th className="text-left py-2 pr-4 font-semibold text-gray-600">Season</th>
                  <th className="text-left py-2 pr-4 font-semibold text-gray-600">Months</th>
                  <th className="text-left py-2 pr-4 font-semibold text-gray-600">Min temp</th>
                  <th className="text-left py-2 pr-4 font-semibold text-gray-600">Max wind</th>
                  <th className="text-left py-2 font-semibold text-gray-600">Max rain</th>
                </tr>
              </thead>
              <tbody>
                {SEASONS.map(({ season, months, temp, wind, rain }) => (
                  <tr key={season} className="border-b border-amber-100">
                    <td className="py-2 pr-4 font-medium">{season}</td>
                    <td className="py-2 pr-4 text-gray-500">{months}</td>
                    <td className="py-2 pr-4">{temp}</td>
                    <td className="py-2 pr-4">{wind}</td>
                    <td className="py-2">{rain}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p>
            The wind and rain thresholds are the same year-round. Rain is rain. And 30 km/h is genuinely
            light wind for Wellington — the old 20 km/h threshold applied to only 12% of all days across
            six years of data.
          </p>
          <p>
            Some months naturally produce very few good days under these rules, and the rules don&apos;t try
            to paper over that. June averages zero. Shitsville (October and November) produces good days
            about 6% of the time. That&apos;s not the app being harsh — that&apos;s Wellington being Wellington.
          </p>

          <h2 className="text-xl font-bold text-gray-800 pt-4">Follow on the fediverse</h2>
          <p>
            This site has a Fediverse account and posts a note whenever it&apos;s a good day —
            nothing more, nothing less. Search for the handle below in Mastodon (or any other
            ActivityPub-compatible app) and hit follow.
          </p>
          <p>
            <code className="block w-fit bg-amber-100 text-amber-900 px-3 py-1.5 rounded text-sm font-mono select-all">
              @CanYouBeat@canyoubeatwellington.radomski.co.nz
            </code>
          </p>

          <p className="pt-4 border-t border-amber-200">
            Built by{" "}
            <a href="https://www.radomski.co.nz" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:text-amber-900 underline underline-offset-2">
              Patrick Radomski <ExternalLink className="inline-block w-3.5 h-3.5 ml-0.5" />
            </a>
            , with some AI help — the whole build (and rebuild) story is on{" "}
            <a href="https://radomski.co.nz/blog/tag/can-you-beat-wellington" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:text-amber-900 underline underline-offset-2">
              the blog <ExternalLink className="inline-block w-3.5 h-3.5 ml-0.5" />
            </a>
            . Say hi on{" "}
            <a href="https://mastodon.nz/@Pat" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:text-amber-900 underline underline-offset-2">
              Mastodon <ExternalLink className="inline-block w-3.5 h-3.5 ml-0.5" />
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}
