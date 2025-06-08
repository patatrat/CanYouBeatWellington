
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useToast } from "@/components/ui/use-toast";
import { removeSunninessRuleAndUpdate } from '../utils/removeSunninessRule';
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
  const [isRunningScript, setIsRunningScript] = useState(false);
  const { toast } = useToast();
  
  const { data: history, isLoading, error } = useQuery({
    queryKey: ['history'],
    queryFn: fetchHistory
  });

  const runSunninessRuleRemoval = async () => {
    setIsRunningScript(true);
    
    try {
      toast({
        title: "Starting Update",
        description: "Removing sunniness rule and updating historical data...",
      });

      const result = await removeSunninessRuleAndUpdate();
      
      if (result.success) {
        toast({
          title: "Update Complete!",
          description: `Successfully updated ${result.updated} records. ${result.changedFromBadToGood} additional days are now considered good days!`,
        });
        
        // Refetch the history data to update the page
        window.location.reload();
      } else {
        toast({
          title: "Update Failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Script Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRunningScript(false);
    }
  };

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
            We've all heard the saying 'You can't beat Wellington on a good day', but how do you know when its a good day? 
            </p>
          <p className="mb-4">
            Here's how it works:
          </p>
          <ul className="list-disc list-inside mb-4">
            <li>We fetch real-time weather data for <a href="https://en.wikipedia.org/wiki/Wellington" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">Wellington, New Zealand <ExternalLink className="inline-block w-4 h-4 ml-1" /></a> from a reliable weather API.</li>
            <li>We analyze three key factors: temperature, wind speed, and rainfall.</li>
            <li>Based on predefined thresholds, we determine if today is a day you "can't beat Wellington."</li>
          </ul>
          <p className="mb-4">
            The thresholds are:
          </p>
          <ul className="list-disc list-inside mb-4">
            <li>Minimum Temperature (Daily Maximum): 18°C</li>
            <li>Maximum Wind Speed: 20 km/h</li>
            <li>Maximum Rainfall: 0 mm</li>
          </ul>
          <p className="mb-4">
            If all these conditions are met, it's considered a day when "you can't beat Wellington." Otherwise...
          </p>
          
          <p className="mt-6 mb-4">
            Built by <a href="https://www.radomski.co.nz" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">Patrick Radomski <ExternalLink className="inline-block w-4 h-4 ml-1" /></a>, with <a href="https://gptengineer.app" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">some AI help <ExternalLink className="inline-block w-4 h-4 ml-1" /></a>.
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
            <h2 className="text-2xl font-bold mb-4">Remove Sunniness Rule</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-4">
            Click the button below to remove the sunniness requirement entirely from the good day criteria. This will update all historical weather records to use only temperature, wind speed, and rainfall as factors.
          </p>
          <p className="mb-4 text-sm text-gray-600">
            <strong>Expected Impact:</strong> This will likely significantly increase the number of good days since many cloudy but otherwise pleasant days will now qualify.
          </p>
          <Button 
            onClick={runSunninessRuleRemoval}
            disabled={isRunningScript}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRunningScript ? 'animate-spin' : ''}`} />
            {isRunningScript ? 'Removing Rule & Updating Data...' : 'Remove Sunniness Rule'}
          </Button>
        </CardContent>
      </Card>
      
      <Card className="w-full max-w-2xl mb-8">
        <CardHeader>
          <CardTitle className="text-center">
            <h2 className="text-2xl font-bold mb-4">You can't beat Wellington on a good day - The Datsun Violets</h2>
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
