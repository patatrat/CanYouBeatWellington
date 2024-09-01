import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Admin = () => {
  const [rules, setRules] = useState({
    minTemp: 18,
    maxWind: 20,
    minSunnyness: 70
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setRules(prevRules => ({
      ...prevRules,
      [name]: parseInt(value)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Save rules (replace with actual API call or local storage)
    console.log('Saving rules:', rules);
    alert('Rules saved!');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-3xl font-bold mb-8">Admin Settings</h1>
      <div className="bg-white p-6 rounded-lg shadow-md mb-8 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">How the Rules Work</h2>
        <p className="text-gray-700 mb-4">
          For a day to be considered "good" in Wellington, all three conditions must be met:
        </p>
        <ul className="list-disc list-inside text-gray-700 mb-4">
          <li>Temperature must be at least the minimum set value</li>
          <li>Wind speed must be below the maximum set value</li>
          <li>Sunnyness must be at least the minimum set percentage</li>
        </ul>
        <p className="text-gray-700">
          If all conditions are met, it's considered a day you "can't beat Wellington."
        </p>
      </div>
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <div className="mb-4">
          <Label htmlFor="minTemp">Minimum Temperature (°C)</Label>
          <Input
            type="number"
            id="minTemp"
            name="minTemp"
            value={rules.minTemp}
            onChange={handleChange}
          />
        </div>
        <div className="mb-4">
          <Label htmlFor="maxWind">Maximum Wind Speed (km/h)</Label>
          <Input
            type="number"
            id="maxWind"
            name="maxWind"
            value={rules.maxWind}
            onChange={handleChange}
          />
        </div>
        <div className="mb-4">
          <Label htmlFor="minSunnyness">Minimum Sunnyness (%)</Label>
          <Input
            type="number"
            id="minSunnyness"
            name="minSunnyness"
            value={rules.minSunnyness}
            onChange={handleChange}
          />
        </div>
        <Button type="submit" className="w-full mb-4">Save Rules</Button>
      </form>
      <Link to="/">
        <Button variant="outline">Back to Home</Button>
      </Link>
    </div>
  );
};

export default Admin;