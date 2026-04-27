'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { cn } from '@/lib/utils';

interface Zone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface UserInZone {
  userId: string;
  userName: string;
  color: string;
  lastSeen: number;
}

// Default predefined zones
const DEFAULT_ZONES: Zone[] = [
  { id: 'zone-ideas', name: 'Ideas', x: 50, y: 50, width: 200, height: 150, color: 'rgba(147, 197, 253, 0.4)' },
  { id: 'zone-discuss', name: 'To Discuss', x: 300, y: 50, width: 200, height: 150, color: 'rgba(253, 224, 71, 0.4)' },
  { id: 'zone-done', name: 'Done', x: 550, y: 50, width: 200, height: 150, color: 'rgba(134, 239, 172, 0.4)' },
  { id: 'zone-review', name: 'Review', x: 50, y: 250, width: 200, height: 150, color: 'rgba(196, 181, 253, 0.4)' },
];

interface PresenceZonesProps {
  visible: boolean;
}

export function PresenceZones({ visible }: PresenceZonesProps) {
  const { users, viewportPosition, viewportZoom, userId } = useCanvasStore();
  const [zones, setZones] = useState<Zone[]>(DEFAULT_ZONES);
  const [usersInZones, setUsersInZones] = useState<Map<string, UserInZone[]>>(new Map());
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Track which zone a user is in based on cursor position
  const getZoneAtPosition = useCallback((x: number, y: number): Zone | null => {
    for (const zone of zones) {
      if (
        x >= zone.x &&
        x <= zone.x + zone.width &&
        y >= zone.y &&
        y <= zone.y + zone.height
      ) {
        return zone;
      }
    }
    return null;
  }, [zones]);

  // Update zone presence when cursor moves
  useEffect(() => {
    const updatePresence = () => {
      const currentUser = users.get(userId);
      if (!currentUser?.cursor) return;

      const cursorX = (currentUser.cursor.x - viewportPosition.x) / viewportZoom;
      const cursorY = (currentUser.cursor.y - viewportPosition.y) / viewportZoom;

      const currentZone = getZoneAtPosition(cursorX, cursorY);
      const previousZone = lastPositionRef.current ? getZoneAtPosition(lastPositionRef.current.x, lastPositionRef.current.y) : null;

      // Only update if zone changed
      if (currentZone?.id !== previousZone?.id) {
        setUsersInZones(prev => {
          const newMap = new Map(prev);

          // Remove from previous zone
          if (previousZone) {
            const prevUsers = newMap.get(previousZone.id) || [];
            newMap.set(
              previousZone.id,
              prevUsers.filter(u => u.userId !== userId)
            );
          }

          // Add to current zone
          if (currentZone) {
            const currentUsers = newMap.get(currentZone.id) || [];
            newMap.set(
              currentZone.id,
              [
                ...currentUsers.filter(u => u.userId !== userId),
                {
                  userId,
                  userName: currentUser.name,
                  color: currentUser.color,
                  lastSeen: Date.now(),
                },
              ]
            );
          }

          return newMap;
        });
      }

      lastPositionRef.current = { x: cursorX, y: cursorY };
    };

    const interval = setInterval(updatePresence, 100);
    return () => clearInterval(interval);
  }, [users, userId, viewportPosition, viewportZoom, getZoneAtPosition]);

  // Clean up stale entries periodically
  useEffect(() => {
    const cleanup = () => {
      setUsersInZones(prev => {
        const newMap = new Map(prev);
        const now = Date.now();

        newMap.forEach((users, zoneId) => {
          newMap.set(
            zoneId,
            users.filter(u => now - u.lastSeen < 5000) // Remove if not seen for 5 seconds
          );
        });

        return newMap;
      });
    };

    const interval = setInterval(cleanup, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Render zone backgrounds */}
      {zones.map((zone) => (
        <div
          key={zone.id}
          className="absolute rounded-lg border-2 border-dashed transition-colors duration-200"
          style={{
            left: zone.x,
            top: zone.y,
            width: zone.width,
            height: zone.height,
            backgroundColor: zone.color,
            borderColor: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          {/* Zone name */}
          <div className="absolute -top-6 left-0 px-2 py-1 bg-white/80 rounded text-xs font-medium">
            {zone.name}
          </div>

          {/* Users in zone */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1 flex-wrap">
            {usersInZones.get(zone.id)?.map((user) => (
              <div
                key={user.userId}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white shadow-md"
                style={{ backgroundColor: user.color }}
                title={user.userName}
              >
                <div
                  className="w-2 h-2 rounded-full bg-white animate-pulse"
                />
                <span className="truncate max-w-[60px]">{user.userName}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Zone legend */}
      <div className="absolute top-4 right-4 bg-white/90 rounded-lg shadow-lg p-3 text-xs">
        <div className="font-medium mb-2">Presence Zones</div>
        <div className="space-y-1">
          {zones.map((zone) => {
            const count = usersInZones.get(zone.id)?.length || 0;
            return (
              <div key={zone.id} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: zone.color }}
                />
                <span>{zone.name}</span>
                {count > 0 && (
                  <span className="text-muted-foreground">({count})</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Hook for managing presence zones toggle
export function usePresenceZones() {
  const [isEnabled, setIsEnabled] = useState(false);
  return { isEnabled, toggle: () => setIsEnabled(prev => !prev) };
}