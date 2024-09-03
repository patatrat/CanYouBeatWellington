import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const About = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-2xl mb-8">
        <CardHeader>
          <CardTitle className="text-center">
            <h1 className="text-3xl font-bold mb-4">About Can You Beat Wellington?</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            This website is a fun and interactive way to check if today is a day when "you can't beat Wellington" weather-wise. It's based on the popular saying among Wellingtonians that on a good day, "You can't beat Wellington on a good day."
          </p>
          <p className="mb-4">
            Here's how it works:
          </p>
          <ul className="list-disc list-inside mb-4">
            <li>We fetch real-time weather data for Wellington from a reliable weather API.</li>
            <li>We analyze four key factors: temperature, wind speed, sunnyness, and rainfall.</li>
            <li>Based on predefined thresholds, we determine if today is a day you "can't beat Wellington."</li>
          </ul>
          <p className="mb-4">
            The thresholds are:
          </p>
          <ul className="list-disc list-inside mb-4">
            <li>Minimum Temperature: 18°C</li>
            <li>Maximum Wind Speed: 10 km/h</li>
            <li>Minimum Sunnyness: 90%</li>
            <li>Maximum Rainfall: 0 mm</li>
          </ul>
          <p className="mb-4">
            If all these conditions are met, it's considered a day when "you can't beat Wellington." Otherwise, it's a day when Wellington can be beaten!
          </p>
          <p className="mb-4">
            Remember, this is all in good fun and meant to celebrate Wellington's famously variable weather. Enjoy your day, whether you can beat Wellington or not!
          </p>
        </CardContent>
      </Card>
      
      <Card className="w-full max-w-2xl mb-8">
        <CardHeader>
          <CardTitle className="text-center">
            <h2 className="text-2xl font-bold mb-4">Wellington: You Can't Beat It on a Good Day</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative" style={{ paddingBottom: '56.25%', height: 0 }}>
            <iframe
              className="absolute top-0 left-0 w-full h-full"
              src="https://www.youtube.com/embed/a4xNdyVPDJQ"
              title="Wellington: You Can't Beat It on a Good Day"
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