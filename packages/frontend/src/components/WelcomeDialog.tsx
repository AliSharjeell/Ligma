'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCanvasStore } from '@/store/canvas-store';

export function WelcomeDialog() {
  const router = useRouter();
  const setUserName = useCanvasStore((s) => s.setUserName);
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'idle' | 'create' | 'join'>('idle');
  const [error, setError] = useState('');

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
      <div className="hidden md:flex md:w-1/2 bg-cover bg-center flex-col justify-center items-center p-12 text-white relative" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80)' }}>
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative max-w-md text-center z-10">
          <h1 className="text-6xl font-bold mb-4 tracking-tight">LIGMA</h1>
          <p className="text-xl text-white/90">Real-time Collaborative Canvas</p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="md:hidden text-center mb-8">
            <h1 className="text-4xl font-bold text-indigo-600 mb-2">LIGMA</h1>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
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
                  onClick={() => handleModeChange('create')}
                  className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  Create New Room
                </button>
                <button
                  onClick={() => handleModeChange('join')}
                  className="w-full px-4 py-3 bg-white text-indigo-600 border-2 border-indigo-600 rounded-lg hover:bg-indigo-50 transition"
                >
                  Join a Room
                </button>
              </div>
            )}

            {/* Room Code Input (shown when in create or join mode) */}
            {mode !== 'idle' && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">
                      {mode === 'create' ? 'Create your room' : 'Enter room code'}
                    </span>
                  </div>
                </div>

                {mode === 'join' && (
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                      onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    />
                  </div>
                )}

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
                    onClick={mode === 'create' ? handleCreate : handleJoin}
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                  >
                    {mode === 'create' ? 'Create Room' : 'Join Room'}
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
