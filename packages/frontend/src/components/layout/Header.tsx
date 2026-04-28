'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TaskBoard } from '@/components/panels/TaskBoard';
import { EventLog } from '@/components/panels/EventLog';
import { LayersPanel } from '@/components/panels/LayersPanel';
import { useSocket } from '@/contexts/socket-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, Users } from 'lucide-react';

interface HeaderProps {
  className?: string;
  currentRoom?: string;
}

export function Header({ className, currentRoom = 'default' }: HeaderProps) {
  const { connected } = useSocket();
  const router = useRouter();
  const normalizedRoom = currentRoom && currentRoom !== 'undefined' ? currentRoom : 'default';
  const [roomInput, setRoomInput] = useState(normalizedRoom);

  useEffect(() => {
    setRoomInput(normalizedRoom);
  }, [normalizedRoom]);

  const handleJoinRoom = () => {
    const trimmed = roomInput.trim();
    if (!trimmed) return;
    router.push(`/room/${encodeURIComponent(trimmed)}`);
  };

  const handleCreateRoom = () => {
    const trimmed = roomInput.trim();
    if (trimmed && trimmed !== normalizedRoom && trimmed !== 'default') {
      router.push(`/room/${encodeURIComponent(trimmed)}`);
    } else {
      const generated = `room-${Math.random().toString(36).slice(2, 8)}`;
      router.push(`/room/${generated}`);
    }
  };

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
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Room: {normalizedRoom}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Join or Create Room</DialogTitle>
              <DialogDescription>
                Use a room ID to collaborate with others.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label htmlFor="roomId">Room ID</Label>
                <Input
                  id="roomId"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  placeholder="e.g. sprint-planning"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleCreateRoom}>
                Create New
              </Button>
              <Button onClick={handleJoinRoom}>
                Join Room
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
          <LayersPanel />
        </div>
      </div>
    </header>
  );
}
