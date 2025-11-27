import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import Sidebar from '../../ui/Sidebar';
import Topbar from '../../ui/Topbar';
import SentimentDashboard from '../../components/SentimentDashboard';
import MCQAnalytics from '../../components/MCQAnalytics';
import { Send, Loader } from 'lucide-react';

export default function AdminDashboard() {
  const socketRef = useRef(null);
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const [displayName] = useState('Instructor-' + Math.random().toString(36).slice(2, 6));
  const [sentiment, setSentiment] = useState({ good: 0, neutral: 0, negative: 0 });
  const [participants, setParticipants] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [mcqs, setMcqs] = useState([]);
  const [selectedMcq, setSelectedMcq] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  function joinAsAdmin() {
    if (!roomId.trim()) {
      setError('Enter a room ID');
      return;
    }

    try {
      socketRef.current = io('http://localhost:3000');

      socketRef.current.emit('join-room', { roomId, displayName, isAdmin: true });

      socketRef.current.on('room-state', ({ participants: p, sentiment: s }) => {
        setParticipants(p);
        setSentiment(s);
      });

      socketRef.current.on('sentiment-updated', ({ distribution }) => {
        setSentiment(distribution);
      });

      socketRef.current.on('mcq-broadcast', (mcq) => {
        setMcqs((prev) => [...prev, mcq]);
        setSelectedMcq(mcq);
      });

      socketRef.current.on('error', ({ message }) => {
        setError(message);
        setTimeout(() => setError(null), 3000);
      });

      setJoined(true);
    } catch (err) {
      setError('Failed to join: ' + err.message);
    }
  }

  function handleGenerateMCQs() {
    if (!prompt.trim()) {
      setError('Enter a prompt for MCQ generation');
      return;
    }

    setGenerating(true);
    socketRef.current.emit('generate-mcq', { roomId, prompt });

    setTimeout(() => {
      setGenerating(false);
      setPrompt('');
    }, 2000);
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      <div className="flex-1">
        <Topbar />

        <div className="p-6 max-w-7xl mx-auto">
          {/* Join Room Section */}
          {!joined && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-indigo-200">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Start Admin Session</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="Enter Room ID (e.g., ABC12345)"
                  className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  onClick={joinAsAdmin}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition"
                >
                  Join as Admin
                </button>
              </div>
              {error && <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-1 rounded">{error}</div>}
            </div>
          )}

          {joined && (
            <>
              {/* Error Display */}
              {error && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-200">
                  {error}
                </div>
              )}

              {/* MCQ Generation Section */}
              <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-l-4 border-l-purple-500">
                <h3 className="text-lg font-bold text-slate-800 mb-3">Generate MCQs</h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Example: Generate 10 MCQs on Data Structures..."
                    className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={generating}
                  />
                  <button
                    onClick={handleGenerateMCQs}
                    disabled={generating}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
                  >
                    {generating ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
                    {generating ? 'Generating...' : 'Generate'}
                  </button>
                </div>
              </div>

              {/* Main Dashboard Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Sentiment Dashboard */}
                <div className="lg:col-span-1">
                  <SentimentDashboard sentiment={sentiment} />
                </div>

                {/* Right: Participants & MCQ History */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Participants */}
                  <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-3">Active Participants ({participants.length})</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {participants.length === 0 ? (
                        <p className="text-slate-500 text-sm">Waiting for participants...</p>
                      ) : (
                        participants
                          .filter((p) => !p.isAdmin)
                          .map((p) => (
                            <div key={p.id} className="border rounded-lg p-3 flex justify-between items-center bg-slate-50">
                              <div>
                                <p className="font-medium text-slate-800">{p.displayName}</p>
                                <p className="text-xs text-slate-500">Joined {new Date(p.joinedAt).toLocaleTimeString()}</p>
                              </div>
                              {p.sentiment && (
                                <span
                                  className={`px-2 py-1 rounded text-xs font-semibold text-white ${
                                    p.sentiment === 'good'
                                      ? 'bg-green-500'
                                      : p.sentiment === 'neutral'
                                        ? 'bg-yellow-500'
                                        : 'bg-red-500'
                                  }`}
                                >
                                  {p.sentiment.charAt(0).toUpperCase() + p.sentiment.slice(1)}
                                </span>
                              )}
                            </div>
                          ))
                      )}
                    </div>
                  </div>

                  {/* MCQ History */}
                  <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-3">MCQ Sessions ({mcqs.length})</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {mcqs.length === 0 ? (
                        <p className="text-slate-500 text-sm">No MCQs generated yet</p>
                      ) : (
                        mcqs.map((mcq, idx) => (
                          <button
                            key={mcq.id}
                            onClick={() => setSelectedMcq(mcq)}
                            className={`w-full text-left border rounded-lg p-3 transition ${
                              selectedMcq?.id === mcq.id
                                ? 'border-indigo-600 bg-indigo-50'
                                : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'
                            }`}
                          >
                            <p className="font-medium text-slate-800">Session {idx + 1}</p>
                            <p className="text-sm text-slate-600 truncate">{mcq.prompt}</p>
                            <p className="text-xs text-slate-500 mt-1">{mcq.mcqs.length} Questions</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* MCQ Analytics */}
              {selectedMcq && (
                <div className="mt-6">
                  <MCQAnalytics mcqSession={selectedMcq} socket={socketRef.current} roomId={roomId} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}