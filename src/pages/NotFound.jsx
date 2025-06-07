
import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-center">
            <h1 className="text-6xl font-bold mb-4 text-gray-600">404</h1>
            <h2 className="text-2xl font-semibold text-gray-800">Page Not Found</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-lg text-gray-600 mb-8">
            Oops! The page you're looking for doesn't exist. Maybe it got blown away by Wellington's wind?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/">
              <Button className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Go Home
              </Button>
            </Link>
            <Button 
              variant="outline" 
              onClick={() => window.history.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
