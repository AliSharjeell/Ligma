'use client';

import React, { useState, useEffect } from 'react';
import { Canvas } from '@/components/Canvas';
import { Toolbar } from '@/components/Toolbar';
import { TaskBoard } from '@/components/TaskBoard';
import { EventLog } from '@/components/EventLog';
import { RoleSelector } from '@/components/RoleSelector';
import { useCanvasStore } from '@/stores/canvasStore';
import { Role } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const [isJoined, setIsJoined] = useState(false);
  const [canvasId] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('canvas') || 'demo-canvas';
    }
    return 'demo-canvas';
  });
  const { currentUser, setCurrentUser, selectNode, setViewport } = useCanvasStore();

  const handleJoin = (userName: string, role: Role) => {
    const user = {
      id: uuidv4(),
      name: userName,
      role
    };
    setCurrentUser(user);
    setIsJoined(true);
  };

  const handleTaskClick = (nodeId: string) => {
    selectNode(nodeId);
    setViewport({ x: 0, y: 0, zoom: 1 });
  };

  if (!isJoined || !currentUser) {
    return <RoleSelector onJoin={handleJoin} />;
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      {/* Main Canvas Area */}
      <div className="flex-1 relative">
        <Canvas canvasId={canvasId} user={currentUser} />
        <Toolbar />
        <EventLog />
      </div>

      {/* Task Board Sidebar */}
      <TaskBoard onTaskClick={handleTaskClick} />
    </div>
  );
}
