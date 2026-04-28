import React from 'react';
import { SocketProvider } from '@/contexts/socket-context';
import { Header } from '@/components/layout/Header';
import { InfiniteCanvas } from '@/components/canvas/InfiniteCanvas';
import { Toolbar } from '@/components/toolbar/Toolbar';
import { PresenceHeatmap } from '@/components/canvas/PresenceHeatmap';
import { PresenceZones } from '@/components/canvas/PresenceZones';
import { TimeTravel } from '@/components/canvas/TimeTravel';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roomId = decodeURIComponent(id ?? 'default');
  console.log('Joining room:', roomId);
  
  return (
    <SocketProvider url={WS_URL} canvasId={roomId}>
      <main className="h-screen w-screen flex flex-col overflow-hidden">
        <Header currentRoom={roomId} />
        <div className="flex-1 relative overflow-hidden">
          <InfiniteCanvas />
          <Toolbar />
          <PresenceHeatmap />
          <PresenceZones />
          <TimeTravel />
        </div>
      </main>
    </SocketProvider>
  );
}
