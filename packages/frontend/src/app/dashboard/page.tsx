'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCanvasStore } from '@/store/canvas-store';
import { generateRoomCode } from '@/lib/utils';
import * as Dialog from '@radix-ui/react-dialog';
import { LogOut, Plus, Users, Clock, Layers } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const BRAND_COLOR = '#50B5FF';

interface RecentRoom {
  id: string;
  name: string;
  lastAccessed: number;
  elementCount: number;
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function DashboardPage() {
  const router = useRouter();
  const userName = useCanvasStore((s) => s.userName);
  const setUserName = useCanvasStore((s) => s.setUserName);
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    loadRecentRooms();
  }, []);

  const loadRecentRooms = () => {
    if (typeof window === 'undefined') return;

    const rooms: RecentRoom[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ligma-canvas-')) {
        const roomId = key.replace('ligma-canvas-', '');
        if (roomId === 'default') continue;

        try {
          const elements = JSON.parse(localStorage.getItem(key) || '[]');
          const metaKey = `ligma-room-meta-${roomId}`;
          const meta = localStorage.getItem(metaKey);
          const lastAccessed = meta ? JSON.parse(meta).lastAccessed : Date.now();

          rooms.push({
            id: roomId,
            name: meta ? JSON.parse(meta).name : roomId,
            lastAccessed,
            elementCount: elements.length,
          });
        } catch {
          rooms.push({
            id: roomId,
            name: roomId,
            lastAccessed: Date.now(),
            elementCount: 0,
          });
        }
      }
    }

    rooms.sort((a, b) => b.lastAccessed - a.lastAccessed);
    setRecentRooms(rooms.slice(0, 12));
  };

  const handleCreateRoom = () => {
    const newRoomCode = generateRoomCode();
    saveRecentRoom(newRoomCode);
    router.push(`/room/${encodeURIComponent(newRoomCode)}`);
  };

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      setJoinError('Please enter a room code');
      return;
    }
    const code = roomCode.trim().toUpperCase();
    saveRecentRoom(code);
    router.push(`/room/${encodeURIComponent(code)}`);
  };

  const saveRecentRoom = (roomId: string) => {
    if (typeof window === 'undefined') return;
    const metaKey = `ligma-room-meta-${roomId}`;
    const existing = localStorage.getItem(metaKey);
    const meta = existing ? JSON.parse(existing) : { name: roomId };
    meta.lastAccessed = Date.now();
    localStorage.setItem(metaKey, JSON.stringify(meta));

    const recentKey = 'ligma-recent-rooms';
    const recent = JSON.parse(localStorage.getItem(recentKey) || '[]');
    const filtered = recent.filter((r: string) => r !== roomId);
    filtered.unshift(roomId);
    localStorage.setItem(recentKey, JSON.stringify(filtered.slice(0, 12)));
  };

  const handleNavigateToRoom = (roomId: string) => {
    saveRecentRoom(roomId);
    router.push(`/room/${encodeURIComponent(roomId)}`);
  };

  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ligma-username');
    }
    setUserName('');
    router.push('/');
  };

  return (
    <ProtectedRoute>
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold" style={{ color: BRAND_COLOR, fontFamily: 'var(--font-lora), serif' }}>
              Ligma
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-600">
                Welcome, <span className="font-medium text-gray-900">{userName}</span>
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={handleCreateRoom}
            className="flex items-center justify-center gap-2 px-4 py-3 text-white rounded-lg transition hover:opacity-90 shadow-sm text-sm font-medium"
            style={{ backgroundColor: BRAND_COLOR }}
          >
            <Plus className="w-4 h-4" />
            <span>Create New Room</span>
          </button>
          <button
            onClick={() => setShowJoinModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg transition hover:border-gray-400 hover:bg-gray-50 shadow-sm text-sm font-medium"
          >
            <Users className="w-4 h-4" />
            <span>Join a Room</span>
          </button>
        </div>

        {/* Recent Canvases Grid */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Canvases</h2>
          {recentRooms.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <Layers className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No recent canvases</h3>
              <p className="text-gray-500">Create a new room or join an existing one to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {recentRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleNavigateToRoom(room.id)}
                  className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-gray-300 hover:shadow-md transition group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 truncate pr-2 group-hover:text-blue-600 transition">
                      {room.name}
                    </h3>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded font-mono">
                      {room.id}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{formatTimeAgo(room.lastAccessed)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      <span>{room.elementCount} elements</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Join Room Modal */}
      <Dialog.Root open={showJoinModal} onOpenChange={setShowJoinModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-full max-w-md shadow-xl z-50">
            <Dialog.Title className="text-xl font-semibold text-gray-900 mb-2">
              Join a Room
            </Dialog.Title>
            <Dialog.Description className="text-gray-500 mb-6">
              Enter the room code shared with you to join the collaboration.
            </Dialog.Description>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Room Code
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => {
                    setRoomCode(e.target.value.toUpperCase());
                    setJoinError('');
                  }}
                  placeholder="Enter room code"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent outline-none transition"
                  style={{ '--tw-ring-color': BRAND_COLOR } as React.CSSProperties}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                  autoFocus
                />
              </div>

              {joinError && (
                <p className="text-red-500 text-sm">{joinError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowJoinModal(false);
                    setRoomCode('');
                    setJoinError('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinRoom}
                  className="flex-1 px-4 py-3 text-white rounded-lg transition hover:opacity-90"
                  style={{ backgroundColor: BRAND_COLOR }}
                >
                  Join Room
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
    </ProtectedRoute>
  );
}
