'use client';

import { useState } from 'react';
import { User, Link as LinkIcon, Bell, Database } from 'lucide-react';

export default function SettingsPage() {
  const [garminEmail, setGarminEmail] = useState('');
  const [garminPassword, setGarminPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');

  const handleGarminConnect = async () => {
    try {
      const res = await fetch('http://localhost:4000/auth/garmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: garminEmail, password: garminPassword }),
      });

      if (res.ok) {
        alert('Garmin connected successfully!');
      } else {
        const data = await res.json();
        alert(`Failed: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to connect Garmin');
    }
  };

  const handleStravaConnect = () => {
    window.location.href = 'http://localhost:4000/auth/strava';
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-white">Settings</h1>

      {/* Profile Section */}
      <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-6 h-6 text-blue-400" />
          <h2 className="text-lg font-semibold">Profile</h2>
        </div>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Weight (kg)</label>
            <input
              type="number"
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
              placeholder="75"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Resting HR (bpm)</label>
            <input
              type="number"
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
              placeholder="55"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Max HR (bpm)</label>
            <input
              type="number"
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
              placeholder="190"
            />
          </div>
          <button className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition">
            Save Profile
          </button>
        </div>
      </div>

      {/* Data Sources */}
      <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3 mb-4">
          <Database className="w-6 h-6 text-green-400" />
          <h2 className="text-lg font-semibold">Data Sources</h2>
        </div>
        <div className="space-y-6">
          {/* Garmin */}
          <div className="p-4 rounded-lg bg-gray-800/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <span className="text-blue-400 font-bold">G</span>
                </div>
                <div>
                  <h3 className="font-medium text-white">Garmin Connect</h3>
                  <p className="text-sm text-gray-400">Auto-sync activities from your Vivoactive</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                Not Connected
              </span>
            </div>
            <div className="space-y-3">
              <input
                type="email"
                value={garminEmail}
                onChange={(e) => setGarminEmail(e.target.value)}
                placeholder="Garmin email"
                className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
              <input
                type="password"
                value={garminPassword}
                onChange={(e) => setGarminPassword(e.target.value)}
                placeholder="Garmin password"
                className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleGarminConnect}
                className="w-full px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition"
              >
                Connect Garmin
              </button>
              <p className="text-xs text-gray-500">
                Note: Uses unofficial API. Your credentials are stored securely.
              </p>
            </div>
          </div>

          {/* Strava */}
          <div className="p-4 rounded-lg bg-gray-800/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <span className="text-orange-400 font-bold">S</span>
                </div>
                <div>
                  <h3 className="font-medium text-white">Strava</h3>
                  <p className="text-sm text-gray-400">Sync activities and segments</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                Not Connected
              </span>
            </div>
            <button
              onClick={handleStravaConnect}
              className="w-full px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition flex items-center justify-center gap-2"
            >
              <LinkIcon className="w-4 h-4" />
              Connect Strava
            </button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="w-6 h-6 text-yellow-400" />
          <h2 className="text-lg font-semibold">Alerts & Notifications</h2>
        </div>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Phone Number (SMS)</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Daily recovery status each morning
            </p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email Address</label>
            <input
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Weekly training summary every Sunday
            </p>
          </div>
          <button className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition">
            Save Alert Preferences
          </button>
        </div>
      </div>

      {/* Race Goals */}
      <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Race Goals</h2>
          <button className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition">
            Add Goal
          </button>
        </div>
        <p className="text-gray-400 text-sm">
          Set your target races to get personalized predictions and training plans.
        </p>
      </div>

      {/* Data Management */}
      <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/50">
        <h2 className="text-lg font-semibold mb-4">Data Management</h2>
        <div className="space-y-3">
          <button className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition">
            Export All Data
          </button>
          <button className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition">
            Re-sync Activities
          </button>
        </div>
      </div>
    </div>
  );
}
