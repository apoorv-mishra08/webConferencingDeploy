import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import io from 'socket.io-client';
import SentimentPanel from '../components/SentimentPanel';
import SentimentDashboard from '../components/SentimentDashboard';
import MCQDisplay from '../components/MCQDisplay';
import MCQAnalytics from '../components/MCQAnalytics';
import Chat from '../components/Chat';
import RemoteVideoGrid from '../components/RemoteVideoGrid';
import { Send, Loader, Users, Mic } from 'lucide-react';
import AudioRecorder from '../utils/audioRecorder';
import { useWebRTC } from '../utils/useWebRTC';

export default function MeetingRoom() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role') || 'participant'; // 'instructor' or 'participant'
  
  const [name, setName] = useState(() => (role === 'instructor' ? 'Instructor-' : 'User-') + Math.random().toString(36).slice(2, 6));
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(name);
  const [joined, setJoined] = useState(false);
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [sentiment, setSentiment] = useState({ good: 0, neutral: 0, negative: 0 });
  const [currentSentiment, setCurrentSentiment] = useState(null);
  const [classSummary, setClassSummary] = useState(null);
  const [mcqSession, setMcqSession] = useState(null);
  const [error, setError] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [mcqs, setMcqs] = useState([]);
  const [selectedMcq, setSelectedMcq] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [responseCount, setResponseCount] = useState({});
  const [engagementHistory, setEngagementHistory] = useState([
    { time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), good: 0, neutral: 0, negative: 0 }
  ]);
  const [chatMessages, setChatMessages] = useState([]);

  // WebRTC P2P Full Mesh - Initialize peer connections
  const { remoteStreams, connectionStatus } = useWebRTC(
    socketRef.current,
    localStreamRef.current,
    participants,
    id
  );

  // Real-time engagement tracking - update every 30 seconds
  useEffect(() => {
    if (!joined || role !== 'instructor') return;

    const interval = setInterval(() => {
      const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      setEngagementHistory(prev => {
        const newHistory = [...prev, { 
          time: currentTime, 
          good: sentiment.good, 
          neutral: sentiment.neutral, 
          negative: sentiment.negative 
        }];
        // Keep only last 5 data points
        return newHistory.slice(-5);
      });
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [joined, role, sentiment]);

  // Update engagement on sentiment change
  useEffect(() => {
    if (!joined || role !== 'instructor') return;
    
    setEngagementHistory(prev => {
      const latest = prev[prev.length - 1];
      const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      // Update the latest entry if it's the same minute, otherwise add new
      if (latest && latest.time === currentTime) {
        const updated = [...prev];
        updated[updated.length - 1] = { 
          time: currentTime, 
          good: sentiment.good, 
          neutral: sentiment.neutral, 
          negative: sentiment.negative 
        };
        return updated;
      }
      return prev;
    });
  }, [sentiment, joined, role]);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  function handleNameChange() {
    if (tempName.trim() && tempName !== name) {
      setName(tempName);
      if (joined && socketRef.current) {
        socketRef.current.emit('update-name', { roomId: id, newName: tempName });
      }
    }
    setIsEditingName(false);
  }

  async function join() {
    try {
      // Use Vite env var in production to point to the socket server (e.g. https://api.example.com)
      const socketUrl = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3000';
      socketRef.current = io(socketUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling']
      });

      // Set up event listeners BEFORE emitting join-room
      socketRef.current.on('room-state', ({ participants: p, sentiment: s }) => {
        console.log('🔔 [room-state] Received for room', id, 'with', p.length, 'participants:', p.map(pp => `${pp.displayName} (${pp.id.substring(0, 8)}...)`));
        console.log('📍 My socket ID:', socketRef.current?.id?.substring(0, 8));
        setParticipants(p);
        setSentiment(s);
        
        // Update current user's sentiment based on participants list
        const currentUser = p.find(participant => participant.id === socketRef.current?.id);
        if (currentUser && currentUser.sentiment) {
          setCurrentSentiment(currentUser.sentiment);
        }
      });

      socketRef.current.on('sentiment-updated', ({ sentiment: s, distribution }) => {
        console.log('Sentiment updated:', distribution);
        setSentiment(distribution);
        
        // Also update current sentiment if it's this user
        if (s === socketRef.current?.id) {
          // The sentiment value is in the distribution
          setCurrentSentiment(s);
        }
      });

      socketRef.current.on('mcq-broadcast', (mcq) => {
        console.log('MCQ broadcasted:', mcq);
        setMcqSession(mcq);
        setMcqs((prev) => [...prev, mcq]);
        if (role === 'instructor') {
          setSelectedMcq(mcq); // Auto-open analytics for instructor
        }
      });

      socketRef.current.on('mcq-response-update', ({ mcqSessionId, totalResponses, totalParticipants }) => {
        console.log('Response update:', mcqSessionId, totalResponses, '/', totalParticipants);
        setResponseCount(prev => ({
          ...prev,
          [mcqSessionId]: { totalResponses, totalParticipants }
        }));
      });

      socketRef.current.on('error', ({ message }) => {
        setError(message);
        setTimeout(() => setError(null), 3000);
      });

      socketRef.current.on('user-removed', () => {
        setError('You have been removed from the meeting by the instructor');
        setTimeout(() => {
          handleLeave();
        }, 2000);
      });

      socketRef.current.on('force-mute', () => {
        setIsMuted(true);
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(track => track.enabled = false);
        }
      });

      socketRef.current.on('receive-message', (message) => {
        console.log('💬 [receive-message] From:', message.userName, 'Role:', message.userRole, 'Text:', message.text.substring(0, 40));
        setChatMessages(prev => [...prev, message]);
      });

      socketRef.current.on('message-reaction-updated', ({ messageId, reactions }) => {
        setChatMessages(prev =>
          prev.map(msg => 
            msg.id === messageId ? { ...msg, reactions } : msg
          )
        );
      });

      socketRef.current.on('class-summary-updated', (summary) => {
        console.log('📊 [class-summary-updated] Class summary updated:', summary);
        setClassSummary(summary);
      });

      socketRef.current.on('transcript-created', ({ transcript, totalTranscripts }) => {
        console.log(`📝 [transcript-created] Transcript ${totalTranscripts} received`);
      });

      socketRef.current.on('transcription-error', ({ message }) => {
        console.error('❌ [transcription-error]', message);
        setError(message);
      });

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log('✅ Got camera and audio');
      } catch (permissionErr) {
        console.error('❌ Media permission denied (video+audio):', permissionErr.message);
        // Try audio only if video fails
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('⚠️ Using audio only (video permission denied)');
          setError('Camera permission denied. Using audio only.');
          setIsCameraOff(true); // Camera is off because no permission
        } catch (audioErr) {
          console.error('❌ Audio permission also denied:', audioErr.message);
          setError('Please allow access to camera and microphone');
          return;
        }
      }
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('✅ Stream attached to video element');
      }

      // Start audio recording for instructor only
      if (role === 'instructor') {
        try {
          console.log('🎙️ [AudioRecorder] Starting for instructor');
          const audioRecorder = new AudioRecorder(stream, (chunk) => {
            console.log(`🎤 [AudioRecorder] Chunk ready: ${chunk.duration}ms`);
            socketRef.current.emit('audio-chunk-recorded', {
              roomId: id,
              ...chunk
            });
          });
          audioRecorder.start();
          audioRecorderRef.current = audioRecorder;
          setIsRecordingAudio(true);
        } catch (err) {
          console.error('❌ [AudioRecorder] Failed to start:', err);
        }
      }

      // Emit join-room AFTER listeners are set up
      console.log('👤 [join-room] Joining room:', id, 'as', name, 'role:', role, 'socket ID:', socketRef.current.id?.substring(0, 8));
      socketRef.current.emit('join-room', { roomId: id, displayName: name, isAdmin: role === 'instructor' });

      setJoined(true);
    } catch (err) {
      setError('Failed to join room: ' + err.message);
    }
  }

  function handleLeave() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    // Stop audio recorder if it's running
    if (audioRecorderRef.current) {
      audioRecorderRef.current.stop();
      audioRecorderRef.current.destroy();
      audioRecorderRef.current = null;
      setIsRecordingAudio(false);
    }
    socketRef.current?.disconnect();
    setJoined(false);
    setParticipants([]);
  }

  function toggleMute() {
    console.log('🔇 toggleMute called. Joined:', joined, 'Stream:', !!localStreamRef.current);
    if (!joined || !localStreamRef.current) {
      console.log('❌ Cannot toggle mute: joined=', joined, 'stream=', !!localStreamRef.current);
      return;
    }
    const audioTracks = localStreamRef.current.getAudioTracks();
    console.log('🎤 Audio tracks found:', audioTracks.length);
    const audioTrack = audioTracks[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      console.log('✅ Audio track toggled. Enabled:', audioTrack.enabled);
      setIsMuted(!audioTrack.enabled);
    } else {
      console.log('❌ No audio track found');
    }
  }

  function toggleCamera() {
    console.log('📹 toggleCamera called. Joined:', joined, 'Stream:', !!localStreamRef.current);
    if (!joined || !localStreamRef.current) {
      console.log('❌ Cannot toggle camera: joined=', joined, 'stream=', !!localStreamRef.current);
      return;
    }
    const videoTracks = localStreamRef.current.getVideoTracks();
    console.log('📷 Video tracks found:', videoTracks.length);
    if (videoTracks.length === 0) {
      console.log('❌ No video track - camera permission may have been denied');
      setError('Camera is not available. Check permissions.');
      return;
    }
    const videoTrack = videoTracks[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      console.log('✅ Video track toggled. Enabled:', videoTrack.enabled);
      setIsCameraOff(!videoTrack.enabled);
    } else {
      console.log('❌ No video track found');
    }
  }

  function handleRemoveUser(participantId) {
    if (role === 'instructor') {
      socketRef.current.emit('remove-user', { roomId: id, participantId });
    }
  }

  function handleMuteUser(participantId) {
    if (role === 'instructor') {
      socketRef.current.emit('mute-user', { roomId: id, participantId });
    }
  }

  function handleGenerateMCQs() {
    if (!prompt.trim()) {
      setError('Enter a prompt for MCQ generation');
      return;
    }

    setGenerating(true);
    socketRef.current.emit('generate-mcq', { roomId: id, prompt });

    setTimeout(() => {
      setGenerating(false);
      setPrompt('');
    }, 2000);
  }

  function handleGenerateFromSummary() {
    if (!classSummary || !classSummary.mainInsights || classSummary.mainInsights.length === 0) {
      setError('No class insights available yet. Please wait for transcription to complete.');
      return;
    }

    setGenerating(true);
    console.log('🤔 [Generate from Summary] Triggering question generation from summary');
    socketRef.current.emit('generate-from-summary', { roomId: id });

    setTimeout(() => {
      setGenerating(false);
    }, 2000);
  }

  function handleSendMessage(text) {
    socketRef.current.emit('send-message', {
      roomId: id,
      userId: socketRef.current.id,
      userName: name,
      userRole: role,
      text
    });
  }

  function handleReactToMessage(messageId, reactionType) {
    socketRef.current.emit('react-to-message', {
      roomId: id,
      messageId,
      reactionType,
      userName: name,
      userId: socketRef.current.id
    });
  }

  return (
    <div className={`min-h-screen flex flex-col bg-slate-900`}>
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <div className="font-semibold text-base text-white">
              WebConference
            </div>
            {role === 'instructor' && (
              <div className="text-xs text-slate-400 mt-0.5">
                Room: <span className="text-blue-400 font-mono">{id}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Name Display/Edit */}
          {joined && (
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-2 bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleNameChange()}
                    className="bg-slate-600 text-white px-2 py-1 rounded text-sm w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  <button onClick={handleNameChange} className="text-emerald-400 hover:text-emerald-300 text-sm">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                  </button>
                  <button onClick={() => { setIsEditingName(false); setTempName(name); }} className="text-rose-400 hover:text-rose-300 text-sm">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsEditingName(true)} 
                  className="flex items-center gap-2 text-slate-300 hover:text-white transition bg-slate-700 bg-opacity-50 hover:bg-opacity-70 px-3 py-2 rounded-lg text-sm border border-slate-700 hover:border-slate-600"
                >
                  <span>{name}</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
          )}
          
          {role === 'instructor' && (
            <div className="flex items-center gap-2 bg-slate-700 bg-opacity-50 border border-slate-700 px-3 py-2 rounded-lg">
              <Users size={16} className="text-slate-400" />
              <span className="text-white text-sm">{participants.length}</span>
            </div>
          )}
          {error && <div className="text-xs text-rose-200 bg-rose-500 bg-opacity-10 border border-rose-500 border-opacity-20 px-3 py-2 rounded-lg">{error}</div>}
          {!joined ? (
            <button onClick={join} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition shadow-lg shadow-blue-500/20">
              Join Room
            </button>
          ) : (
            <button onClick={handleLeave} className="bg-rose-500 hover:bg-rose-600 text-white px-5 py-2 rounded-lg text-sm font-medium transition shadow-lg shadow-rose-500/20">
              Leave
            </button>
          )}
        </div>
      </div>

      {joined && mcqSession && <MCQDisplay mcqSession={mcqSession} socket={socketRef.current} roomId={id} participantId={socketRef.current?.id} onClose={() => setMcqSession(null)} />}

      {role === 'instructor' ? (
        // INSTRUCTOR VIEW - Minimalist Dark Theme
        <div className="flex flex-1 gap-4 overflow-hidden bg-slate-900 p-5">
          {/* Left Side - Video and Poll Generation */}
          <div className="flex-1 flex flex-col gap-4">
            {/* Video Section with Participants Grid */}
            <div className="flex gap-4 flex-1 min-h-0">
              {/* Main Video - Fixed aspect ratio */}
              <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden relative group" style={{ minHeight: '400px', maxHeight: 'calc(100vh - 200px)' }}>
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full bg-black object-cover" />
                
                {/* Camera Off Overlay */}
                {isCameraOff && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </div>
                      <p className="text-slate-400 text-sm">Camera Off</p>
                    </div>
                  </div>
                )}

                {/* Video Controls */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 opacity-100 transition-opacity z-20">
                  <button
                    type="button"
                    onClick={(e) => {
                      console.log('🔘 Mute button clicked');
                      e.preventDefault();
                      e.stopPropagation();
                      toggleMute();
                    }}
                    className={`p-3 rounded-lg backdrop-blur-md transition cursor-pointer ${
                      isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 bg-opacity-80 hover:bg-slate-600'
                    }`}
                  >
                    {isMuted ? (
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      console.log('🔘 Camera button clicked');
                      e.preventDefault();
                      e.stopPropagation();
                      toggleCamera();
                    }}
                    className={`p-3 rounded-lg backdrop-blur-md transition cursor-pointer ${
                      isCameraOff ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 bg-opacity-80 hover:bg-slate-600'
                    }`}
                  >
                    {isCameraOff ? (
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A2 2 0 0019 13V6a2 2 0 00-3.53-1.235L14 6.5V5a2 2 0 00-2-2h-.5L10.5 2H5a2 2 0 00-2 2v.879l-.707-.586zM5 5v8h8V5H5z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* WebRTC Remote Video Grid */}
              {remoteStreams && remoteStreams.length > 0 && (
                <div className="w-64 bg-slate-900 border border-slate-700 rounded-xl p-3 mb-3">
                  <p className="text-xs text-slate-400 mb-2 font-medium">📹 Live Participants</p>
                  <RemoteVideoGrid 
                    remoteStreams={remoteStreams} 
                    connectionStatus={connectionStatus} 
                  />
                </div>
              )}

              {/* Participants Grid - Small on right of video */}
              <div className="w-64 grid grid-cols-2 gap-2">
                {participants.filter(p => !p.isAdmin).slice(0, 4).map((p) => (
                  <div key={p.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex flex-col items-center justify-center relative aspect-square hover:border-slate-600 transition group">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm mb-1.5">
                      {p.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-slate-300 text-xs font-medium text-center truncate w-full">
                      {p.displayName}
                    </div>
                    {p.sentiment && (
                      <div 
                        className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                          p.sentiment === 'good' ? 'bg-emerald-400' : p.sentiment === 'neutral' ? 'bg-amber-400' : 'bg-rose-400'
                        }`}
                      />
                    )}
                    
                    {/* Instructor Controls */}
                    <div className="absolute inset-0 bg-slate-900 bg-opacity-0 group-hover:bg-opacity-80 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => handleMuteUser(p.id)}
                        className="p-1.5 bg-amber-500 hover:bg-amber-600 rounded transition"
                        title="Mute user"
                      >
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRemoveUser(p.id)}
                        className="p-1.5 bg-rose-500 hover:bg-rose-600 rounded transition"
                        title="Remove user"
                      >
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Generate AI Poll Section */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"></path><path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z"></path></svg>
                <h3 className="font-medium text-slate-200 text-sm">AI Question Generator</h3>
              </div>

              {role === 'instructor' ? (
                <div className="space-y-3">
                  {classSummary && classSummary.mainInsights && classSummary.mainInsights.length > 0 ? (
                    <>
                      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 max-h-24 overflow-y-auto">
                        <p className="text-xs text-slate-400 mb-2">📊 Class Insights:</p>
                        <ul className="text-xs text-slate-300 space-y-1">
                          {classSummary.mainInsights.slice(0, 3).map((insight, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="text-slate-500">•</span>
                              <span>{insight.substring(0, 60)}...</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleGenerateFromSummary}
                          disabled={generating}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                        >
                          {generating ? (
                            <>
                              <Loader size={16} className="animate-spin" />
                              <span>Generating...</span>
                            </>
                          ) : (
                            <>
                              <Mic size={16} />
                              <span>Generate Question</span>
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-400">
                        {isRecordingAudio ? '⏳ Waiting for initial audio transcription...' : '⏹️ Audio recording not started'}
                      </p>
                    </div>
                  )}
                  
                  <div className="border-t border-slate-700 pt-3">
                    <p className="text-xs text-slate-400 mb-2">Or use custom prompt:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Enter custom topic..."
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition"
                        disabled={generating}
                      />
                      <button
                        onClick={handleGenerateMCQs}
                        disabled={generating}
                        className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 disabled:text-slate-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1"
                      >
                        {generating ? (
                          <Loader size={14} className="animate-spin" />
                        ) : (
                          <Send size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-400">Questions are generated by the instructor based on class discussion.</p>
                </div>
              )}
            </div>

            {/* Active Polls Section with Live Response Count */}
            {mcqs.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <h3 className="font-medium text-slate-200 text-sm mb-3">Active Polls</h3>
                <div className="space-y-2">
                  {mcqs.map((mcq, idx) => {
                    const responses = responseCount[mcq.id] || { totalResponses: 0, totalParticipants: 0 };
                    const percentage = responses.totalParticipants > 0 
                      ? Math.round((responses.totalResponses / responses.totalParticipants) * 100) 
                      : 0;
                    
                    return (
                      <div
                        key={mcq.id}
                        className="bg-slate-900 border border-slate-700 rounded-lg p-3 hover:border-slate-600 transition"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-slate-300 text-sm mb-1 line-clamp-1">"{mcq.prompt}"</p>
                            <p className="text-slate-500 text-xs">{mcq.mcqs?.length || 0} questions</p>
                          </div>
                          <button
                            onClick={() => setSelectedMcq(mcq)}
                            className="text-blue-400 hover:text-blue-300 text-xs font-medium ml-3 px-3 py-1.5 bg-blue-500 bg-opacity-10 rounded-lg hover:bg-opacity-20 transition"
                          >
                            Analytics
                          </button>
                        </div>
                        
                        {/* Live Response Counter */}
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 font-mono min-w-[60px] text-right">
                            {responses.totalResponses}/{responses.totalParticipants}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Side - Live Analytics Panel */}
          <aside className="w-80 bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col gap-4 overflow-y-auto">
            {/* Chat Component - Fixed at top */}
            <div className="mb-4 flex-shrink-0">
              <Chat
                messages={chatMessages}
                onSendMessage={handleSendMessage}
                onReactToMessage={handleReactToMessage}
                currentUserId={socketRef.current?.id}
                currentRole={role}
              />
            </div>

            {/* Live Analytics Header */}
            <div className="flex items-center gap-2 pb-3 border-b border-slate-700">
              <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"></path></svg>
              <h2 className="text-base font-semibold text-white">Live Analytics</h2>
            </div>

            {/* Current Sentiment */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
              <h3 className="text-slate-300 font-medium text-xs mb-3 uppercase tracking-wider">Current Sentiment</h3>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                    <span className="text-slate-400 text-sm">Positive</span>
                  </div>
                  <span className="text-white font-semibold text-sm">{sentiment.good}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                    <span className="text-slate-400 text-sm">Neutral</span>
                  </div>
                  <span className="text-white font-semibold text-sm">{sentiment.neutral}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-rose-400 rounded-full"></div>
                    <span className="text-slate-400 text-sm">Negative</span>
                  </div>
                  <span className="text-white font-semibold text-sm">{sentiment.negative}</span>
                </div>
              </div>
            </div>

            {/* Engagement Over Time Chart - Real-time */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex-1">
              <h3 className="text-slate-300 font-medium text-xs mb-3 uppercase tracking-wider">Engagement Timeline</h3>
              <div className="h-40 flex items-end justify-around gap-2">
                {engagementHistory.map((data, idx) => {
                  const total = Math.max(data.good + data.neutral + data.negative, 1);
                  const maxHeight = 130;
                  const greenHeight = (data.good / total) * maxHeight;
                  const yellowHeight = (data.neutral / total) * maxHeight;
                  const redHeight = (data.negative / total) * maxHeight;
                  
                  return (
                    <div key={idx} className="flex flex-col items-center flex-1">
                      <div className="w-full flex flex-col-reverse items-center gap-0.5 rounded-sm overflow-hidden">
                        {data.good > 0 && (
                          <div 
                            className="w-full bg-emerald-500 transition-all duration-500 ease-in-out" 
                            style={{ height: `${greenHeight}px`, minHeight: '3px' }}
                          />
                        )}
                        {data.neutral > 0 && (
                          <div 
                            className="w-full bg-amber-500 transition-all duration-500 ease-in-out" 
                            style={{ height: `${yellowHeight}px`, minHeight: '3px' }}
                          />
                        )}
                        {data.negative > 0 && (
                          <div 
                            className="w-full bg-rose-500 transition-all duration-500 ease-in-out" 
                            style={{ height: `${redHeight}px`, minHeight: '3px' }}
                          />
                        )}
                      </div>
                      <span className="text-slate-500 text-[10px] mt-2 font-mono">{data.time}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-[10px] text-slate-500 text-center">
                Real-time updates
              </div>
            </div>

            {/* Participants List */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-slate-300 font-medium text-xs uppercase tracking-wider">Participants</h3>
                <span className="text-slate-500 text-xs">{participants.filter(p => !p.isAdmin).length}</span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {participants.filter(p => !p.isAdmin).map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg p-2 hover:border-slate-600 transition">
                    <span className="text-slate-300 text-xs truncate">{p.displayName}</span>
                    {p.sentiment && (
                      <div 
                        className={`w-2 h-2 rounded-full flex-shrink-0 ml-2 ${
                          p.sentiment === 'good' ? 'bg-emerald-400' : p.sentiment === 'neutral' ? 'bg-amber-400' : 'bg-rose-400'
                        }`}
                      />
                    )}
                  </div>
                ))}
                {participants.filter(p => !p.isAdmin).length === 0 && (
                  <p className="text-slate-500 text-xs text-center py-2">No participants yet</p>
                )}
              </div>
            </div>
          </aside>

          {/* MCQ Analytics Modal */}
          {selectedMcq && (
            <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setSelectedMcq(null)}>
              <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-700">
                  <h3 className="font-semibold text-white text-lg">Poll Analytics</h3>
                  <button onClick={() => setSelectedMcq(null)} className="text-slate-400 hover:text-white transition">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                  </button>
                </div>
                <MCQAnalytics mcqSession={selectedMcq} socket={socketRef.current} roomId={id} />
              </div>
            </div>
          )}
        </div>
      ) : (
        // PARTICIPANT VIEW - Minimalist Dark Theme
        <div className="flex flex-1 gap-4 overflow-hidden bg-slate-900 p-5">
          {/* Main Video Area */}
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden relative group" style={{ minHeight: '400px', maxHeight: 'calc(100vh - 200px)' }}>
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full bg-black object-cover" />
              
              {/* Camera Off Overlay */}
              {(isCameraOff || !joined) && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-slate-400 text-sm">Camera Off</p>
                  </div>
                </div>
              )}

              {/* Video Controls for Participant */}
              {joined && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <button
                    type="button"
                    onClick={(e) => {
                      console.log('🔘 Participant mute button clicked');
                      e.preventDefault();
                      e.stopPropagation();
                      toggleMute();
                    }}
                    className={`p-3 rounded-lg backdrop-blur-md transition cursor-pointer ${
                      isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 bg-opacity-80 hover:bg-slate-600'
                    }`}
                  >
                    {isMuted ? (
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      console.log('🔘 Participant camera button clicked');
                      e.preventDefault();
                      e.stopPropagation();
                      toggleCamera();
                    }}
                    className={`p-3 rounded-lg backdrop-blur-md transition cursor-pointer ${
                      isCameraOff ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 bg-opacity-80 hover:bg-slate-600'
                    }`}
                  >
                    {isCameraOff ? (
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A2 2 0 0019 13V6a2 2 0 00-3.53-1.235L14 6.5V5a2 2 0 00-2-2h-.5L10.5 2H5a2 2 0 00-2 2v.879l-.707-.586zM5 5v8h8V5H5z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* WebRTC Remote Video Grid for Participants */}
            {remoteStreams && remoteStreams.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                <p className="text-xs text-slate-400 mb-2 font-medium">📹 Other Participants</p>
                <RemoteVideoGrid 
                  remoteStreams={remoteStreams} 
                  connectionStatus={connectionStatus} 
                />
              </div>
            )}

            {/* Sentiment Panel - Below Video */}
            {joined && (
              <SentimentPanel 
                socket={socketRef.current} 
                roomId={id} 
                currentSentiment={currentSentiment}
                onSentimentChange={setCurrentSentiment}
              />
            )}
          </div>

          {/* Right Sidebar: Participants Grid - Dynamic Layout */}
          <aside className="w-72 flex flex-col gap-4">
            {/* Chat Component */}
            <Chat
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              onReactToMessage={handleReactToMessage}
              currentUserId={socketRef.current?.id}
              currentRole={role}
            />

            {/* Participants Grid */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700">
                <h3 className="font-medium text-slate-200 text-sm flex items-center gap-2">
                  <Users size={16} className="text-slate-400" />
                  <span>Participants</span>
                </h3>
                <span className="text-xs bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full">{participants.length}</span>
              </div>
              
              {/* Dynamic Grid - adjusts columns based on participant count */}
              <div className={`grid gap-2 overflow-y-auto flex-1 auto-rows-min ${
                participants.length === 1 ? 'grid-cols-1' :
                participants.length === 2 ? 'grid-cols-2' :
                participants.length <= 4 ? 'grid-cols-2' :
                participants.length <= 6 ? 'grid-cols-2' :
                participants.length <= 9 ? 'grid-cols-3' :
                'grid-cols-2'
              }`}>
                {participants.map((p) => (
                  <div 
                    key={p.id} 
                    className={`bg-slate-900 border border-slate-700 rounded-lg flex flex-col items-center justify-center relative transition-all hover:border-slate-600 ${
                      participants.length === 1 ? 'p-6' :
                      participants.length === 2 ? 'p-5' :
                      participants.length <= 4 ? 'p-3' :
                      participants.length <= 6 ? 'p-2.5' :
                      participants.length <= 9 ? 'p-2' :
                      'p-2.5'
                    }`}
                  >
                    {/* Avatar */}
                    <div 
                      className={`rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold mb-1.5 ${
                        participants.length === 1 ? 'w-16 h-16 text-2xl' :
                        participants.length === 2 ? 'w-14 h-14 text-xl' :
                        participants.length <= 4 ? 'w-10 h-10 text-base' :
                        participants.length <= 9 ? 'w-8 h-8 text-sm' :
                        'w-7 h-7 text-xs'
                      }`}
                    >
                      {p.displayName.charAt(0).toUpperCase()}
                    </div>
                    
                    {/* Name */}
                    <div 
                      className={`text-slate-300 font-medium text-center truncate w-full ${
                        participants.length === 1 ? 'text-sm' :
                        participants.length === 2 ? 'text-xs' :
                        participants.length <= 9 ? 'text-[11px]' :
                        'text-[10px]'
                      }`}
                    >
                      {p.displayName}
                    </div>
                    
                    {/* Sentiment Indicator */}
                    {p.sentiment && (
                      <div 
                        className={`absolute top-1.5 right-1.5 rounded-full ${
                          participants.length <= 4 ? 'w-2.5 h-2.5' : 'w-2 h-2'
                        } ${
                          p.sentiment === 'good'
                            ? 'bg-emerald-400'
                            : p.sentiment === 'neutral'
                              ? 'bg-amber-400'
                              : 'bg-rose-400'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
              
              {/* No participants message */}
              {participants.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <Users size={40} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No participants yet</p>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}