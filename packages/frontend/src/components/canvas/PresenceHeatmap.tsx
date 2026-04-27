'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { cn } from '@/lib/utils';

interface HeatmapZone {
  x: number;
  y: number;
  count: number;
}

const GRID_SIZE = 100; // pixels per grid cell
const HEATMAP_OPACITY = 0.6;

const getDensityColor = (count: number): string => {
  if (count === 0) return 'rgba(34, 197, 94, 0)'; // transparent green
  if (count < 5) return `rgba(34, 197, 94, ${HEATMAP_OPACITY})`; // low - green
  if (count < 15) return `rgba(234, 179, 8, ${HEATMAP_OPACITY})`; // medium - yellow
  return `rgba(239, 68, 68, ${HEATMAP_OPACITY})`; // high - red
};

interface PresenceHeatmapProps {
  visible: boolean;
}

export function PresenceHeatmap({ visible }: PresenceHeatmapProps) {
  const { viewportPosition, viewportZoom } = useCanvasStore();
  const [zones, setZones] = useState<HeatmapZone[]>([]);
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });

  // Track cursor movements and update heatmap
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Get the canvas element
      const canvas = document.querySelector('[data-canvas]');
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Calculate grid cell position relative to viewport
      const gridX = Math.floor((x - viewportPosition.x) / viewportZoom / GRID_SIZE);
      const gridY = Math.floor((y - viewportPosition.y) / viewportZoom / GRID_SIZE);

      setZones(prev => {
        const newZones = [...prev];
        const existingIndex = newZones.findIndex(z => z.x === gridX && z.y === gridY);

        if (existingIndex >= 0) {
          newZones[existingIndex] = { ...newZones[existingIndex], count: newZones[existingIndex].count + 1 };
        } else {
          newZones.push({ x: gridX, y: gridY, count: 1 });
        }

        // Decay old zones slightly over time
        return newZones.map(zone => ({
          ...zone,
          count: Math.max(0, zone.count - 0.01)
        })).filter(z => z.count > 0);
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [viewportPosition]);

  // Calculate the visible grid range
  const visibleGridRange = useMemo(() => {
    const canvas = document.querySelector('[data-canvas]');
    if (!canvas) return { minX: -10, maxX: 10, minY: -10, maxY: 10 };

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const startX = Math.floor(-viewportPosition.x / viewportZoom / GRID_SIZE) - 2;
    const startY = Math.floor(-viewportPosition.y / viewportZoom / GRID_SIZE) - 2;
    const endX = Math.ceil((width - viewportPosition.x) / viewportZoom / GRID_SIZE) + 2;
    const endY = Math.ceil((height - viewportPosition.y) / viewportZoom / GRID_SIZE) + 2;

    return { minX: startX, maxX: endX, minY: startY, maxY: endY };
  }, [viewportPosition]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg className="absolute inset-0 w-full h-full">
        {zones
          .filter(zone =>
            zone.x >= visibleGridRange.minX &&
            zone.x <= visibleGridRange.maxX &&
            zone.y >= visibleGridRange.minY &&
            zone.y <= visibleGridRange.maxY
          )
          .map((zone, index) => (
            <rect
              key={`${zone.x}-${zone.y}`}
              x={zone.x * GRID_SIZE}
              y={zone.y * GRID_SIZE}
              width={GRID_SIZE}
              height={GRID_SIZE}
              fill={getDensityColor(zone.count)}
              stroke="rgba(0,0,0,0.1)"
              strokeWidth={1}
            />
          ))}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white/90 rounded-lg shadow-lg p-3 text-xs">
        <div className="font-medium mb-2">Activity Heatmap</div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.6)' }} />
          <span>Low</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(234, 179, 8, 0.6)' }} />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.6)' }} />
          <span>High</span>
        </div>
      </div>
    </div>
  );
}

export function usePresenceHeatmap() {
  const [isEnabled, setIsEnabled] = useState(false);
  return { isEnabled, toggle: () => setIsEnabled(prev => !prev) };
}