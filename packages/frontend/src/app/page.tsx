'use client';

import React from 'react';
import { SocketProvider } from '@/contexts/socket-context';
import { Header } from '@/components/layout/Header';
import { InfiniteCanvas } from '@/components/canvas/InfiniteCanvas';
import { Toolbar } from '@/components/toolbar/Toolbar';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

export default function Home() {
  return (
    <SocketProvider url={WS_URL}>
      <main className="h-screen w-screen flex flex-col overflow-hidden">
        <Header />
        <div className="flex-1 relative overflow-hidden">
          <InfiniteCanvas />
          <Toolbar />
        </div>
      </main>
    </SocketProvider>
  );
}