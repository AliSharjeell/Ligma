'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCanvasStore } from '@/store/canvas-store';

export function WelcomeDialog() {
  const router = useRouter();
  const setUserName = useCanvasStore((s) => s.setUserName);
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');

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

  const handleCreate = () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    setUserName(name.trim());
    const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push(`/room/${encodeURIComponent(newRoomCode)}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-purple-100">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
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
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Join or Create Room</span>
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
              placeholder="Enter room code to join"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleJoin}
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
            >
              Join Room
            </button>
            <button
              onClick={handleCreate}
              className="flex-1 px-4 py-3 bg-white text-indigo-600 border-2 border-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition"
            >
              Create New
            </button>
          </div>
        </div>

        <p className="text-center text-gray-400 text-xs mt-6">
          Share your room code with others to collaborate in real-time
        </p>
      </div>
    </div>
  );
}
