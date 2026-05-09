import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import CalendarHistory from '../components/CalendarHistory';
import MonthlyGoodDaysChart from '../components/MonthlyGoodDaysChart';
import FunFacts from '../components/FunFacts';

const fetchHistory = async () => {
  const { data, error } = await supabase
    .from('daily_weather_records')
    .select('*')
    .order('date', { ascending: false });
  
  if (error) throw error;
  return data;
};

const About = () => {
  const { data: history, isLoading, error } = useQuery({
    queryKey: ['history'],
    queryFn: fetchHistory
  });

  React.useEffect(() => {
    document.title = "You Can't Beat Wellington on a Good Day — About | Can You Beat Wellington?";
    return () => {
      document.title = "You Can't Beat Wellington on a Good Day — Can You Beat Wellington?";
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-2xl mb-8">
        <CardHeader>
          <CardTitle className="text-center">
            <h1 className="text-3xl font-bold mb-4">What is this all about?</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            {`"You can't beat Wellington on a good day" — Wellington's most famous weather saying. But how often is it actually true?`}
          </p>
          <p className="mb-4">
            Every day we fetch real weather data for Wellington from a weather API, check it against three conditions, and if all three pass, it&apos;s a good day.
          </p>

          <h2 className="text-xl font-semibold mb-3">The rules</h2>
          <p className="mb-4">
            Wellington has six seasons, not four — at least according to the locals. The app uses seasonal temperature thresholds based on{' '}
            <a href="https://adam.nz/realistic-calendar" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
              Adam Shand&apos;s Shitsville calendar <ExternalLink className="inline-block w-4 h-4 ml-1" />
            </a>
            , calibrated against six years of actual Wellington weather data.
          </p>

          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-semibold">Season</th>
                  <th className="text-left py-2 pr-4 font-semibold">Months</th>
                  <th className="text-left py-2 pr-4 font-semibold">Min temp</th>
                  <th className="text-left py-2 pr-4 font-semibold">Max wind</th>
                  <th className="text-left py-2 font-semibold">Max rain</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { season: 'Summer',     months: 'Jan, Feb, Mar', temp: '19°C', wind: '30 km/h', rain: '0 mm' },
                  { season: 'Autumn',     months: 'Apr, May, Jun', temp: '16°C', wind: '30 km/h', rain: '0 mm' },
                  { season: 'Winter',     months: 'Jul, Aug',      temp: '13°C', wind: '30 km/h', rain: '0 mm' },
                  { season: 'Spring 1',   months: 'Sep',           temp: '14°C', wind: '30 km/h', rain: '0 mm' },
                  { season: 'Shitsville', months: 'Oct, Nov',      temp: '16°C', wind: '30 km/h', rain: '0 mm' },
                  { season: 'Spring 2',   months: 'Dec',           temp: '18°C', wind: '30 km/h', rain: '0 mm' },
                ].map(({ season, months, temp, wind, rain }) => (
                  <tr key={season} className="border-b border-gray-100">
                    <td className="py-2 pr-4 font-medium">{season}</td>
                    <td className="py-2 pr-4 text-gray-600">{months}</td>
                    <td className="py-2 pr-4">{temp}</td>
                    <td className="py-2 pr-4">{wind}</td>
                    <td className="py-2">{rain}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mb-4">
            The wind and rain thresholds are the same year-round. Rain is rain. And 30 km/h is genuinely light wind for Wellington — the old 20 km/h threshold applied to only 12% of all days across six years of data.
          </p>
          <p className="mb-4">
            Some months naturally produce very few good days under these rules, and the rules don&apos;t try to paper over that. June averages zero. Shitsville (October and November) produces good days about 6% of the time. That&apos;s not the app being harsh — that&apos;s Wellington being Wellington.
          </p>

          <p className="mt-6 mb-4">
            Built by <a href="https://www.radomski.co.nz" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">Patrick Radomski <ExternalLink className="inline-block w-4 h-4 ml-1" /></a>, with some AI help.
          </p>
          <p className="mb-4">
            Contact me on <a href="https://mastodon.nz/@Pat" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">Mastodon <ExternalLink className="inline-block w-4 h-4 ml-1" /></a>.
          </p>
        </CardContent>
      </Card>
      
      {!isLoading && !error && history && <FunFacts history={history} />}
      
      <Card className="w-full max-w-4xl mb-8">
        <CardHeader>
          <CardTitle className="text-center">
            <h2 className="text-2xl font-bold mb-4">Weather History Calendar</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-center">Loading history...</p>}
          {error && <p className="text-center text-red-500">Error loading history: {error.message}</p>}
          {history && <CalendarHistory history={history} />}
        </CardContent>
      </Card>
      
      <Card className="w-full max-w-4xl mb-8">
        <CardHeader>
          <CardTitle className="text-center">
            <h2 className="text-2xl font-bold mb-4">Good Days Per Month</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-center">Loading data...</p>}
          {error && <p className="text-center text-red-500">Error loading data: {error.message}</p>}
          {history && <MonthlyGoodDaysChart history={history} />}
        </CardContent>
      </Card>
      
      <Card className="w-full max-w-2xl mb-8">
        <CardHeader>
          <CardTitle className="text-center">
            <h2 className="text-2xl font-bold mb-4">{`You can't beat Wellington on a good day - The Datsun Violets`}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative" style={{ paddingBottom: '56.25%', height: 0 }}>
            <iframe
              className="absolute top-0 left-0 w-full h-full"
              src="https://www.youtube.com/embed/a4xNdyVPDJQ"
              title="You can't beat Wellington on a good day - The Datsun Violets"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-4">
        <Link to="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </div>
    </div>
  );
};

export default About;
