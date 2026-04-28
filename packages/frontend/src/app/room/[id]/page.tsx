'use client';

import React, { useEffect, useState } from 'react';
import { SocketProvider } from '@/contexts/socket-context';
import { InfiniteCanvas } from '@/components/canvas/InfiniteCanvas';
import { Toolbar } from '@/components/toolbar/Toolbar';
import { PresenceHeatmap } from '@/components/canvas/PresenceHeatmap';
import { PresenceZones } from '@/components/canvas/PresenceZones';
import { TimeTravel } from '@/components/canvas/TimeTravel';

const WS_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const [roomId, setRoomId] = useState<string>('default');

  useEffect(() => {
    params.then(p => setRoomId(decodeURIComponent(p.id ?? 'default')));
  }, [params]);

  // Force re-mount when roomId changes by using key
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
