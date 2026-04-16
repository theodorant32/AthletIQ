'use client';

import { useState } from 'react';
import { User, Link as LinkIcon, Bell, Database, Target } from 'lucide-react';

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your profile, data sources, and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Section */}
        <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <User className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-lg font-medium text-white">Profile</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Weight (kg)</label>
              <input
                type="number"
                className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition"
                placeholder="75"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Resting HR (bpm)</label>
              <input
                type="number"
                className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition"
                placeholder="55"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Max HR (bpm)</label>
              <input
                type="number"
                className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition"
                placeholder="190"
              />
            </div>
            <button className="w-full px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition">
              Save Profile
            </button>
          </div>
        </div>

        {/* Race Goals */}
        <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900/50">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Target className="w-5 h-5 text-green-400" />
              </div>
              <h2 className="text-lg font-medium text-white">Race Goals</h2>
            </div>
            <button className="px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition">
              Add Goal
            </button>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Set your target races to get personalized predictions and training plans tailored to your event.
          </p>
        </div>
      </div>

      {/* Data Sources */}
      <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-green-500/10">
            <Database className="w-5 h-5 text-green-400" />
          </div>
          <h2 className="text-lg font-medium text-white">Data Sources</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Garmin */}
          <div className="p-5 rounded-xl bg-gray-800/50 border border-gray-700/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <span className="text-blue-400 font-bold text-sm">G</span>
                </div>
                <div>
                  <h3 className="font-medium text-white">Garmin</h3>
                  <p className="text-xs text-gray-400">Vivoactive sync</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                Not Connected
              </span>
            </div>
            <div className="space-y-3">
              <input
                type="email"
                value={garminEmail}
                onChange={(e) => setGarminEmail(e.target.value)}
                placeholder="Garmin email"
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <input
                type="password"
                value={garminPassword}
                onChange={(e) => setGarminPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleGarminConnect}
                className="w-full px-4 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition"
              >
                Connect
              </button>
              <p className="text-xs text-gray-500 leading-relaxed">
                Uses unofficial API. Credentials stored securely.
              </p>
            </div>
          </div>

          {/* Strava */}
          <div className="p-5 rounded-xl bg-gray-800/50 border border-gray-700/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <span className="text-orange-400 font-bold text-sm">S</span>
                </div>
                <div>
                  <h3 className="font-medium text-white">Strava</h3>
                  <p className="text-xs text-gray-400">Activities & segments</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                Not Connected
              </span>
            </div>
            <button
              onClick={handleStravaConnect}
              className="w-full px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition flex items-center justify-center gap-2"
            >
              <LinkIcon className="w-4 h-4" />
              Connect
            </button>
          </div>
        </div>
      </div>

      {/* Alerts & Notifications */}
      <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-yellow-500/10">
            <Bell className="w-5 h-5 text-yellow-400" />
          </div>
          <h2 className="text-lg font-medium text-white">Alerts & Notifications</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Phone Number (SMS)</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition"
            />
            <p className="text-xs text-gray-500 mt-2">
              Daily recovery status each morning
            </p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Email Address</label>
            <input
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition"
            />
            <p className="text-xs text-gray-500 mt-2">
              Weekly training summary every Sunday
            </p>
          </div>
        </div>
        <div className="mt-6">
          <button className="px-6 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition">
            Save Preferences
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900/50">
        <h2 className="text-lg font-medium text-white mb-4">Data Management</h2>
        <div className="flex gap-3">
          <button className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-sm font-medium transition">
            Export All Data
          </button>
          <button className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-sm font-medium transition">
            Re-sync Activities
          </button>
        </div>
      </div>
    </div>
  );
}
