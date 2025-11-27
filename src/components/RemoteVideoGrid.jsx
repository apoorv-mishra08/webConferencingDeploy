import React, { useEffect, useRef } from 'react';

/**
 * RemoteVideoGrid Component
 * Displays remote peer video streams in a responsive grid layout
 * 
 * @param {Array} remoteStreams - Array of { peerId, stream, id }
 * @param {Object} connectionStatus - Map of peerId -> connectionState
 */
export default function RemoteVideoGrid({ remoteStreams, connectionStatus }) {
  if (!remoteStreams || remoteStreams.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      {/* Grid layout - responsive */}
      <div className={`grid gap-2 ${
        remoteStreams.length === 1 ? 'grid-cols-1' :
        remoteStreams.length === 2 ? 'grid-cols-2' :
        'grid-cols-3'
      }`}>
        {remoteStreams.map((remoteStream) => (
          <RemoteVideoCard
            key={remoteStream.peerId}
            remoteStream={remoteStream}
            status={connectionStatus[remoteStream.peerId] || 'connecting'}
          />
        ))}
      </div>
      
      {/* Connection summary */}
      <div className="mt-2 text-center">
        <p className="text-[10px] text-slate-500">
          {remoteStreams.length} peer{remoteStreams.length !== 1 ? 's' : ''} connected
        </p>
      </div>
    </div>
  );
}

/**
 * Individual video card for one remote peer
 */
function RemoteVideoCard({ remoteStream, status }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && remoteStream.stream) {
      videoRef.current.srcObject = remoteStream.stream;
      console.log(`📺 [RemoteVideoGrid] Attached stream for peer ${remoteStream.peerId.substring(0, 8)}`);
    }
  }, [remoteStream.stream, remoteStream.peerId]);

  // Status badge color
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-emerald-500';
      case 'connecting':
        return 'bg-amber-500';
      case 'disconnected':
        return 'bg-rose-500';
      case 'failed':
        return 'bg-red-600';
      default:
        return 'bg-slate-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const hasVideo = remoteStream.stream && remoteStream.stream.getVideoTracks().length > 0;
  const hasAudio = remoteStream.stream && remoteStream.stream.getAudioTracks().length > 0;

  return (
    <div className="relative bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
      {/* Video element */}
      <div className="relative w-full" style={{ paddingBottom: '75%' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          className="absolute inset-0 w-full h-full object-cover bg-black"
        />
        
        {/* No video overlay */}
        {!hasVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-slate-700 flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="text-xs text-slate-500">No video</p>
            </div>
          </div>
        )}

        {/* Connection status badge */}
        <div className="absolute top-2 left-2">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full backdrop-blur-md bg-black bg-opacity-50 ${getStatusColor()} bg-opacity-20`}>
            <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor()}`}></div>
            <span className="text-[10px] text-white font-medium">{getStatusText()}</span>
          </div>
        </div>

        {/* Muted indicator */}
        {!hasAudio && (
          <div className="absolute top-2 right-2">
            <div className="p-1.5 rounded-full backdrop-blur-md bg-black bg-opacity-50">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Peer ID label */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
        <p className="text-xs text-white font-medium truncate">
          Peer {remoteStream.peerId.substring(0, 8)}
        </p>
      </div>
    </div>
  );
}