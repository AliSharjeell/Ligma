'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import type { CanvasElement } from '@/types/canvas';

interface TimelineSnapshot {
  elements: Map<string, CanvasElement>;
  timestamp: number;
}

interface TimeTravelProps {
  visible?: boolean;
}

const PLAYBACK_INTERVAL_MS = 650;

export function TimeTravel({ visible }: TimeTravelProps) {
  const {
    sessionTimeline,
    timeTravelEnabled,
    setTimeTravelEnabled,
    setReplayFrameElements,
  } = useCanvasStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const snapshots = useMemo<TimelineSnapshot[]>(
    () => [...sessionTimeline].sort((a, b) => a.timestamp - b.timestamp),
    [sessionTimeline]
  );

  const maxStep = Math.max(0, snapshots.length - 1);
  const isVisible = visible ?? timeTravelEnabled;

  useEffect(() => {
    if (!isVisible) {
      setIsPlaying(false);
      setReplayFrameElements(null);
      return;
    }

    if (snapshots.length === 0) {
      setReplayFrameElements(null);
      return;
    }

    if (currentStep > maxStep) {
      setCurrentStep(maxStep);
    }
  }, [currentStep, isVisible, maxStep, setReplayFrameElements, snapshots.length]);

  useEffect(() => {
    if (!isVisible) return;
    const snapshot = snapshots[currentStep];
    if (!snapshot) return;
    setReplayFrameElements(snapshot.elements);
  }, [currentStep, isVisible, setReplayFrameElements, snapshots]);

  useEffect(() => {
    if (!isVisible || !isPlaying || snapshots.length === 0) return;

    if (currentStep >= maxStep) {
      setIsPlaying(false);
      return;
    }

    playTimeoutRef.current = setTimeout(() => {
      setCurrentStep((prev) => Math.min(prev + 1, maxStep));
    }, PLAYBACK_INTERVAL_MS);

    return () => {
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
      }
    };
  }, [currentStep, isPlaying, isVisible, maxStep, snapshots.length]);

  const handleClose = useCallback(() => {
    setIsPlaying(false);
    setReplayFrameElements(null);
    setTimeTravelEnabled(false);
  }, [setReplayFrameElements, setTimeTravelEnabled]);

  const handlePlayPause = useCallback(() => {
    if (snapshots.length === 0) return;
    setIsPlaying((prev) => !prev);
  }, [snapshots.length]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep(0);
  }, []);

  const handleStepBack = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const handleStepForward = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep((prev) => Math.min(maxStep, prev + 1));
  }, [maxStep]);

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
  const hasSnapshots = snapshots.length > 0;

  if (!isVisible) return null;

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl border p-4 w-[520px] z-20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">Time Travel Replay</h3>
        <Button variant="ghost" size="sm" onClick={handleClose}>
          ×
        </Button>
      </div>

      {!hasSnapshots ? (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
          No timeline snapshots recorded yet. Start editing layers to build replay history.
        </div>
      ) : (
        <div className="space-y-4">
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
              <span>{formatTimestamp(snapshots[0].timestamp)}</span>
              <span>Step {currentStep + 1} of {snapshots.length}</span>
              <span>{formatTimestamp(snapshots[maxStep].timestamp)}</span>
            </div>
          </div>

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

          {currentSnapshot && (
            <div className="bg-muted/50 rounded-lg p-3 text-xs">
              <div className="font-medium mb-1">
                Snapshot at {formatTimestamp(currentSnapshot.timestamp)}
              </div>
              <div className="text-muted-foreground">
                {currentSnapshot.elements.size} elements visible
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
