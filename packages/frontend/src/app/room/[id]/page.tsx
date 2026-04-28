'use client';

import React from 'react';
import { SocketProvider } from '@/contexts/socket-context';
import { InfiniteCanvas } from '@/components/canvas/InfiniteCanvas';
import { Toolbar } from '@/components/toolbar/Toolbar';
import { PresenceHeatmap } from '@/components/canvas/PresenceHeatmap';
import { PresenceZones } from '@/components/canvas/PresenceZones';
import { TimeTravel } from '@/components/canvas/TimeTravel';

const WS_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function RoomPage({ params }: { params: { id: string } }) {
  const roomId = decodeURIComponent(params.id ?? 'default');

  return (
    <SocketProvider url={WS_URL} canvasId={roomId}>
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
