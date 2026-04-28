'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { Play, Pause, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import type { CanvasEvent, CanvasElement } from '@/types/canvas';

interface CanvasSnapshot {
  elements: Map<string, CanvasElement>;
  timestamp: number;
}

// StateReconstructor utility
class StateReconstructor {
  private snapshots: Map<number, CanvasSnapshot> = new Map();

  addSnapshot(elements: Map<string, CanvasElement>, timestamp: number) {
    this.snapshots.set(timestamp, {
      elements: new Map(elements),
      timestamp,
    });
  }

  getSnapshotAtTime(timestamp: number): CanvasSnapshot | null {
    const sortedTimestamps = Array.from(this.snapshots.keys()).sort((a, b) => a - b);
    const closestTimestamp = sortedTimestamps.find(t => t <= timestamp);
    return closestTimestamp ? this.snapshots.get(closestTimestamp) || null : null;
  }

  getSnapshots(): CanvasSnapshot[] {
    return Array.from(this.snapshots.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  getTimeRange(): { start: number; end: number } | null {
    const snapshots = this.getSnapshots();
    if (snapshots.length === 0) return null;
    return {
      start: snapshots[0].timestamp,
      end: snapshots[snapshots.length - 1].timestamp,
    };
  }

  rebuildStateAtStep(stepIndex: number): Map<string, CanvasElement> {
    const snapshots = this.getSnapshots();
    if (stepIndex < 0 || stepIndex >= snapshots.length) {
      return new Map();
    }
    return new Map(snapshots[stepIndex].elements);
  }
}

interface TimeTravelProps {
  visible?: boolean;
}

export function TimeTravel({ visible }: TimeTravelProps) {
  const { eventLog, elements, timeTravelEnabled } = useCanvasStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [reconstructedElements, setReconstructedElements] = useState<Map<string, CanvasElement>>(elements);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const reconstructor = useRef(new StateReconstructor());

  // Build state snapshots from event log
  useEffect(() => {
    const snap = reconstructor.current;
    snap.addSnapshot(elements, Date.now());

    // Process event log to build intermediate states
    eventLog.forEach((event) => {
      const currentElements = snap.getSnapshotAtTime(event.timestamp)?.elements || new Map();
      const newElements = new Map(currentElements);

      switch (event.type) {
        case 'create':
          // Element was created, add it (we'd need element data in the event)
          break;
        case 'update':
          // Element was updated
          if (event.elementId) {
            const el = newElements.get(event.elementId);
            if (el) {
              newElements.set(event.elementId, { ...el, updatedAt: event.timestamp });
            }
          }
          break;
        case 'delete':
          if (event.elementId) {
            newElements.delete(event.elementId);
          }
          break;
      }

      snap.addSnapshot(newElements, event.timestamp);
    });
  }, [eventLog, elements]);

  const snapshots = reconstructor.current.getSnapshots();
  const timeRange = reconstructor.current.getTimeRange();
  const maxStep = Math.max(0, snapshots.length - 1);

  useEffect(() => {
    if (isPlaying && currentStep < maxStep) {
      playIntervalRef.current = setTimeout(() => {
        setCurrentStep(prev => Math.min(prev + 1, maxStep));
      }, 1000);
    } else {
      setIsPlaying(false);
    }

    return () => {
      if (playIntervalRef.current) {
        clearTimeout(playIntervalRef.current);
      }
    };
  }, [isPlaying, currentStep, maxStep]);

  useEffect(() => {
    const newState = reconstructor.current.rebuildStateAtStep(currentStep);
    setReconstructedElements(newState);
  }, [currentStep]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep(0);
  }, []);

  const handleStepBack = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep(prev => Math.max(0, prev - 1));
  }, []);

  const handleStepForward = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep(prev => Math.min(maxStep, prev + 1));
  }, []);

  const handleSliderChange = useCallback((value: number[]) => {
    setIsPlaying(false);
    setCurrentStep(value[0]);
  }, []);

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const currentSnapshot = snapshots[currentStep];

  const isVisible = visible ?? timeTravelEnabled;
  if (!isVisible) return null;

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl border p-4 w-[500px] z-20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">Time Travel Replay</h3>
        <Button variant="ghost" size="sm" onClick={()=>{console.log('Closing TimeTravel')}}>
          ×
        </Button>
      </div>

      <div className="space-y-4">
        {/* Timeline Slider */}
        <div className="space-y-2">
          <Slider
            value={[currentStep]}
            min={0}
            max={maxStep}
            step={1}
            onValueChange={handleSliderChange}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            {timeRange && (
              <>
                <span>{formatTimestamp(timeRange.start)}</span>
                <span>Step {currentStep + 1} of {snapshots.length}</span>
                <span>{formatTimestamp(timeRange.end)}</span>
              </>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="icon" onClick={handleReset} title="Reset">
            <RotateCcw className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleStepBack} title="Step Back">
            <SkipBack className="size-4" />
          </Button>
          <Button
            variant={isPlaying ? 'default' : 'outline'}
            size="icon"
            onClick={handlePlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={handleStepForward} title="Step Forward">
            <SkipForward className="size-4" />
          </Button>
        </div>

        {/* Current Event Info */}
        {currentSnapshot && (
          <div className="bg-muted/50 rounded-lg p-3 text-xs">
            <div className="font-medium mb-1">
              Snapshot at {formatTimestamp(currentSnapshot.timestamp)}
            </div>
            <div className="text-muted-foreground">
              {currentSnapshot.elements.size} elements on canvas
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Export the reconstructor for use in other components
export { StateReconstructor };