import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const [meetingId, setMeetingId] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function createMeeting() {
    setLoading(true);
    try {
      const res = await fetch('/api/create-meeting', { method: 'POST' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}. Make sure the backend server is running on port 3000.`);
      }
      const data = await res.json();
      alert(`Meeting Created!\nRoom Code: ${data.meetingId}\n\nShare this code with participants to join.`);
      navigate(`/room/${data.meetingId}?role=instructor`);
    } catch (error) {
      console.error('Error creating meeting:', error);
      alert(`Failed to create meeting.\n\n${error.message}\n\nMake sure:\n1. Backend server is running (npm start in server/)\n2. MongoDB is running\n3. Port 3000 is not in use`);
    } finally {
      setLoading(false);
    }
  }

  function join() {
    if (!meetingId.trim()) {
      alert('Enter meeting id');
      return;
    }
    navigate(`/room/${meetingId}?role=participant`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-5xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">WebConference</h1>
          <p className="text-slate-400 text-lg">Real-time collaboration platform with AI-powered insights</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 hover:border-slate-600 transition-all duration-300 group">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-500 bg-opacity-20 rounded-lg flex items-center justify-center text-blue-400 text-xl group-hover:bg-opacity-30 transition">
                👨‍🏫
              </div>
              <h2 className="text-2xl font-semibold text-white">Host Meeting</h2>
            </div>
            <p className="text-slate-400 mb-8 leading-relaxed">Create a new session and receive a room code to share with participants.</p>
            <button onClick={createMeeting} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 py-4 rounded-lg font-medium transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </span>
              ) : 'Create New Meeting'}
            </button>
            <div className="mt-6 pt-6 border-t border-slate-700">
              <p className="text-xs text-slate-500 font-medium mb-3 uppercase tracking-wider">Features</p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Real-time sentiment analytics
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  AI-powered poll generation
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Engagement tracking
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 hover:border-slate-600 transition-all duration-300 group">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-emerald-500 bg-opacity-20 rounded-lg flex items-center justify-center text-emerald-400 text-xl group-hover:bg-opacity-30 transition">
                👥
              </div>
              <h2 className="text-2xl font-semibold text-white">Join Meeting</h2>
            </div>
            <p className="text-slate-400 mb-8 leading-relaxed">Enter the room code provided by your host to join the session.</p>
            <input value={meetingId} onChange={(e) => setMeetingId(e.target.value)} placeholder="Enter room code" onKeyPress={(e) => e.key === 'Enter' && join()} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-4 mb-4 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-20 focus:outline-none transition-all" />
            <button onClick={join} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-lg font-medium transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40">
              Join Session
            </button>
            <div className="mt-6 pt-6 border-t border-slate-700">
              <p className="text-xs text-slate-500 font-medium mb-3 uppercase tracking-wider">Features</p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Instant feedback submission
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Interactive polls
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Live collaboration
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">
            Need help? <a href="/admin" className="text-blue-400 hover:text-blue-300 transition">Visit admin dashboard</a>
          </p>
        </div>
      </div>
    </div>
  );
}
