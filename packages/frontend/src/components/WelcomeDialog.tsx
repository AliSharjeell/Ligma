'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCanvasStore } from '@/store/canvas-store';

const BRAND_COLOR = '#50B5FF';

export function WelcomeDialog() {
  const router = useRouter();
  const setUserName = useCanvasStore((s) => s.setUserName);
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'idle' | 'create' | 'join'>('idle');
  const [error, setError] = useState('');

  // Ping backend on mount to wake it up
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    fetch(`${apiUrl}/health`)
      .catch(() => {
        // Silently ignore - backend might not be ready yet
      });
  }, []);

  const handleCreate = () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    setUserName(name.trim());
    const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push(`/room/${encodeURIComponent(newRoomCode)}`);
  };

  const handleJoin = () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }
    setUserName(name.trim());
    router.push(`/room/${encodeURIComponent(roomCode.trim())}`);
  };

  const handleModeChange = (newMode: 'create' | 'join') => {
    if (!name.trim()) {
      setError('Please enter your name first');
      return;
    }
    setMode(newMode);
    setError('');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden md:flex md:w-1/2 bg-cover bg-center flex-col justify-center items-center p-12 text-white relative" style={{ backgroundImage: 'url(/pexels-michael-spadoni-269949-813465.jpg)', filter: 'saturate(1.2)' }}>
        <div className="max-w-md text-center">
          <h1 className="text-6xl font-bold mb-4 tracking-tight" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)', fontFamily: 'var(--font-lora), serif' }}>Ligma</h1>
          <p className="text-xl text-white" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>Real-time Collaborative Canvas</p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="md:hidden text-center mb-8">
            <h1 className="text-4xl font-bold mb-2" style={{ color: BRAND_COLOR, fontFamily: 'var(--font-lora), serif' }}>Ligma</h1>
            <p className="text-gray-500">Real-time Collaborative Canvas</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 outline-none transition"
                style={{ '--tw-ring-color': BRAND_COLOR, '--tw-ring-offset-color': '#fff', '--tw-border-color': BRAND_COLOR } as React.CSSProperties}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && mode === 'join') handleJoin();
                  else if (e.key === 'Enter' && mode === 'idle') handleModeChange('create');
                }}
              />
            </div>

            {/* Mode Selection Buttons */}
            {mode === 'idle' && (
              <div className="space-y-3">
                <button
                  onClick={handleCreate}
                  className="w-full px-4 py-3 text-white rounded-lg transition hover:opacity-90"
                  style={{ backgroundColor: BRAND_COLOR }}
                >
                  Create New Room
                </button>
                <button
                  onClick={() => handleModeChange('join')}
                  className="w-full px-4 py-3 rounded-lg transition hover:opacity-90"
                  style={{ backgroundColor: '#C9E8FF', color: 'black' }}
                >
                  Join a Room
                </button>
              </div>
            )}

            {/* Join Room Form */}
            {mode === 'join' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Room Code
                  </label>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => {
                      setRoomCode(e.target.value.toUpperCase());
                      setError('');
                    }}
                    placeholder="Enter room code"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 outline-none transition"
                    style={{ '--tw-ring-color': BRAND_COLOR, '--tw-ring-offset-color': '#fff', '--tw-border-color': BRAND_COLOR } as React.CSSProperties}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setMode('idle');
                      setRoomCode('');
                    }}
                    className="px-4 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleJoin}
                    className="flex-1 px-4 py-3 text-white rounded-lg transition hover:opacity-90"
                    style={{ backgroundColor: BRAND_COLOR }}
                  >
                    Join Room
                  </button>
                </div>
              </>
            )}

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}
          </div>

          <p className="text-center text-gray-400 text-xs mt-6">
            Share your room code with others to collaborate in real-time
          </p>
        </div>
      </div>
    </div>
  );
}
