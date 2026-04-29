'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import type { CanvasElement } from '@/types/canvas';

interface HeatmapZone {
  gridX: number;
  gridY: number;
  score: number;
}

interface TimelineFrame {
  elements: Map<string, CanvasElement>;
  timestamp: number;
}

const GRID_SIZE = 140; // world-space pixels per heat cell
const WEIGHTS = {
  create: 4,
  update: 2.1,
  movedUpdate: 3,
  delete: 3.2,
} as const;

const zoneKey = (gridX: number, gridY: number) => `${gridX}:${gridY}`;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const toColor = (score: number, maxScore: number): string => {
  const normalized = clamp01(score / Math.max(maxScore, 1));
  const hue = 210 - normalized * 210; // blue -> red
  const alpha = 0.18 + normalized * 0.52;
  return `hsla(${hue}, 92%, 55%, ${alpha})`;
};

const getElementCenter = (element: CanvasElement): { x: number; y: number } => {
  if (element.type === 'drawing' && element.points && element.points.length > 0) {
    const minX = Math.min(...element.points.map((p) => p.x));
    const maxX = Math.max(...element.points.map((p) => p.x));
    const minY = Math.min(...element.points.map((p) => p.y));
    const maxY = Math.max(...element.points.map((p) => p.y));
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }

  return {
    x: element.position.x + element.size.width / 2,
    y: element.position.y + element.size.height / 2,
  };
};

const recordZone = (zones: Map<string, HeatmapZone>, worldX: number, worldY: number, weight: number) => {
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return;

  const gridX = Math.floor(worldX / GRID_SIZE);
  const gridY = Math.floor(worldY / GRID_SIZE);
  const key = zoneKey(gridX, gridY);
  const existing = zones.get(key);

  if (existing) {
    existing.score += weight;
  } else {
    zones.set(key, { gridX, gridY, score: weight });
  }
};

const buildHeatmapFromTimeline = (timeline: TimelineFrame[]): HeatmapZone[] => {
  if (timeline.length < 2) return [];

  const zones = new Map<string, HeatmapZone>();

  for (let i = 1; i < timeline.length; i += 1) {
    const previous = timeline[i - 1].elements;
    const current = timeline[i].elements;

    current.forEach((element, id) => {
      const center = getElementCenter(element);
      const prevElement = previous.get(id);

      if (!prevElement) {
        recordZone(zones, center.x, center.y, WEIGHTS.create);
        return;
      }

      const prevCenter = getElementCenter(prevElement);
      const movedDistance = Math.hypot(center.x - prevCenter.x, center.y - prevCenter.y);
      const changed =
        prevElement.updatedAt !== element.updatedAt ||
        Math.abs(center.x - prevCenter.x) > 0.5 ||
        Math.abs(center.y - prevCenter.y) > 0.5 ||
        prevElement.content !== element.content;

      if (!changed) return;

      const weight = movedDistance > GRID_SIZE * 0.35 ? WEIGHTS.movedUpdate : WEIGHTS.update;
      recordZone(zones, center.x, center.y, weight);
    });

    previous.forEach((element, id) => {
      if (current.has(id)) return;
      const center = getElementCenter(element);
      recordZone(zones, center.x, center.y, WEIGHTS.delete);
    });
  }

  return Array.from(zones.values()).sort((a, b) => b.score - a.score);
};

interface PresenceHeatmapProps {
  visible?: boolean;
}

export function PresenceHeatmap({ visible }: PresenceHeatmapProps) {
  const { sessionTimeline, viewportPosition, viewportZoom, presenceHeatmapEnabled } = useCanvasStore();
  const [zones, setZones] = useState<HeatmapZone[]>([]);
  const wasVisibleRef = useRef(false);

  const isVisible = visible ?? presenceHeatmapEnabled;

  useEffect(() => {
    if (isVisible && !wasVisibleRef.current) {
      const frozenTimeline = sessionTimeline.map((frame) => ({
        timestamp: frame.timestamp,
        elements: new Map(frame.elements),
      }));
      setZones(buildHeatmapFromTimeline(frozenTimeline));
    }

    wasVisibleRef.current = isVisible;
  }, [isVisible, sessionTimeline]);

  const visibleGridRange = useMemo(() => {
    if (typeof window === 'undefined') return { minX: -10, maxX: 10, minY: -10, maxY: 10 };
    const canvas = document.querySelector<HTMLElement>('[data-canvas="true"]');
    if (!canvas) return { minX: -10, maxX: 10, minY: -10, maxY: 10 };

    const rect = canvas.getBoundingClientRect();
    const startX = Math.floor((-viewportPosition.x / viewportZoom) / GRID_SIZE) - 2;
    const startY = Math.floor((-viewportPosition.y / viewportZoom) / GRID_SIZE) - 2;
    const endX = Math.ceil(((rect.width - viewportPosition.x) / viewportZoom) / GRID_SIZE) + 2;
    const endY = Math.ceil(((rect.height - viewportPosition.y) / viewportZoom) / GRID_SIZE) + 2;

    return { minX: startX, maxX: endX, minY: startY, maxY: endY };
  }, [viewportPosition.x, viewportPosition.y, viewportZoom]);

  const visibleZones = useMemo(
    () =>
      zones.filter(
        (zone) =>
          zone.gridX >= visibleGridRange.minX &&
          zone.gridX <= visibleGridRange.maxX &&
          zone.gridY >= visibleGridRange.minY &&
          zone.gridY <= visibleGridRange.maxY
      ),
    [visibleGridRange.maxX, visibleGridRange.maxY, visibleGridRange.minX, visibleGridRange.minY, zones]
  );

  const maxVisibleScore = useMemo(
    () => visibleZones.reduce((max, zone) => Math.max(max, zone.score), 0),
    [visibleZones]
  );

  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute inset-0 origin-top-left"
        style={{
          transform: `translate(${viewportPosition.x}px, ${viewportPosition.y}px) scale(${viewportZoom})`,
        }}
      >
        {visibleZones.map((zone) => (
          <div
            key={`${zone.gridX}-${zone.gridY}`}
            className="absolute"
            style={{
              left: zone.gridX * GRID_SIZE,
              top: zone.gridY * GRID_SIZE,
              width: GRID_SIZE,
              height: GRID_SIZE,
              backgroundColor: toColor(zone.score, maxVisibleScore),
              border: '1px solid rgba(15, 23, 42, 0.06)',
            }}
          />
        ))}
      </div>

      <div className="absolute bottom-4 right-4 bg-white/90 rounded-lg shadow-lg p-3 text-xs min-w-[200px]">
        <div className="font-medium mb-2">Session Presence Heatmap</div>
        <div className="text-[11px] text-slate-600 mb-2">Static replay summary from recorded layer changes</div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: toColor(1, 3) }} />
          <span>Low</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: toColor(2, 3) }} />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: toColor(3, 3) }} />
          <span>High</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          {zones.length} zones from {sessionTimeline.length} recorded snapshots
        </div>
      </div>
    </div>
  );
}
