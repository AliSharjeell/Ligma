'use client';

import React, { useEffect, useState } from 'react';
import { SocketProvider } from '@/contexts/socket-context';
import { InfiniteCanvas } from '@/components/canvas/InfiniteCanvas';
import { Toolbar } from '@/components/toolbar/Toolbar';
import { PresenceHeatmap } from '@/components/canvas/PresenceHeatmap';
import { PresenceZones } from '@/components/canvas/PresenceZones';
import { TimeTravel } from '@/components/canvas/TimeTravel';
import { useRouter } from 'next/navigation';
import { useCanvasStore } from '@/store/canvas-store';

const WS_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [roomId, setRoomId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const loadElements = useCanvasStore((state) => state.loadElements);

  useEffect(() => {
    params.then(p => {
      const id = decodeURIComponent(p.id ?? '');
      if (!id) {
        router.push('/');
      } else {
        setRoomId(id);
        loadElements(id);
        setLoading(false);
      }
    });
  }, [params, router, loadElements]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="text-indigo-600">Loading room...</div>
      </div>
    );
  }

  return (
    <SocketProvider key={roomId} url={WS_URL} canvasId={roomId}>
      <main className="h-screen w-screen relative overflow-hidden bg-white">
        <InfiniteCanvas />
        <Toolbar />
        <PresenceHeatmap />
        <PresenceZones />
        <TimeTravel />
      </main>
    </SocketProvider>
  );
}
