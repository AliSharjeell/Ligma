'use client';

import React from 'react';
import { TaskBoard } from '@/components/panels/TaskBoard';
import { EventLog } from '@/components/panels/EventLog';
import { useSocket } from '@/contexts/socket-context';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, Users } from 'lucide-react';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const { connected } = useSocket();

  return (
    <header className={cn('h-14 border-b bg-white px-4 flex items-center justify-between', className)}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">L</span>
          </div>
          <h1 className="text-xl font-semibold">LIGMA</h1>
        </div>
        <span className="text-xs text-muted-foreground">Collaborative Canvas</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
            connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          )}>
            {connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">2 online</span>
        </div>

        <div className="flex items-center gap-2">
          <TaskBoard />
          <EventLog />
        </div>
      </div>
    </header>
  );
}