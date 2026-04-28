'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCanvasStore } from '@/store/canvas-store';

export function WelcomeDialog() {
  const router = useRouter();
  const setUserName = useCanvasStore((s) => s.setUserName);
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [showJoin, setShowJoin] = useState(false);
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

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 flex-col justify-center items-center p-12 text-white">
        <div className="max-w-md text-center">
          <h1 className="text-6xl font-bold mb-4 tracking-tight">LIGMA</h1>
          <p className="text-xl text-indigo-100 mb-8">Real-time Collaborative Canvas</p>
          <div className="space-y-4 text-indigo-200">
            <p className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
              </svg>
              Brainstorm together in real-time
            </p>
            <p className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI-powered task extraction
            </p>
            <p className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Time-travel through history
            </p>
          </div>
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
                  if (e.key === 'Enter') {
                    if (showJoin) handleJoin();
                    else setShowJoin(true);
                  }
                }}
              />
            </div>

            {!showJoin ? (
              <button
                onClick={() => {
                  if (!name.trim()) {
                    setError('Please enter your name first');
                    return;
                  }
                  setShowJoin(true);
                }}
                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                Create New Room
              </button>
            ) : (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">or join existing room</span>
                  </div>
                </div>

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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition mb-4"
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowJoin(false);
                      setRoomCode('');
                    }}
                    className="flex-1 px-4 py-3 bg-white text-indigo-600 border-2 border-indigo-600 rounded-lg hover:bg-indigo-50 transition"
                  >
                    Create New Room
                  </button>
                  <button
                    onClick={handleJoin}
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
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
