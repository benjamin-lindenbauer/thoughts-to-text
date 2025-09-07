'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, Volume2, VolumeX } from 'lucide-react';
import { AudioPlayer as AudioPlayerClass, formatDuration } from '@/lib/audio';
import { AudioPlaybackState } from '@/types';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { useAriaLiveRegion } from '@/hooks/useAccessibility';

interface AudioPlayerProps {
  audioBlob: Blob;
  className?: string;
  showVolumeControl?: boolean;
  showTimeDisplay?: boolean;
  autoPlay?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onError?: (error: Error) => void;
}

export function AudioPlayer({
  audioBlob,
  className = '',
  showVolumeControl = true,
  showTimeDisplay = true,
  autoPlay = false,
  onPlay,
  onPause,
  onStop,
  onError
}: AudioPlayerProps) {
  const [playbackState, setPlaybackState] = useState<AudioPlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(1);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  const playerRef = useRef<AudioPlayerClass | null>(null);
  const isSeekingRef = useRef(false);
  
  // Accessibility hooks
  const { announce, LiveRegion } = useAriaLiveRegion();

  // Handle state changes from audio player
  const handleStateChange = useCallback((state: AudioPlaybackState) => {
    setPlaybackState(state);
  }, []);

  // Handle errors from audio player
  const handleError = useCallback((error: Error) => {
    // If parent provides onError, delegate so it can decide (e.g., show fallback)
    if (onError) {
      onError(error);
    } else {
      setError(error.message);
    }
  }, [onError]);

  // Initialize audio player
  useEffect(() => {
    const initializePlayer = async () => {
      try {
        setIsLoading(true);
        setError(null);
        // Clear any previous fallback URL when re-initializing
        if (fallbackUrl) {
          try { URL.revokeObjectURL(fallbackUrl); } catch {}
          setFallbackUrl(null);
        }

        // Clean up previous player
        if (playerRef.current) {
          playerRef.current.cleanup();
        }

        // Create new player
        playerRef.current = new AudioPlayerClass(handleStateChange, handleError);
        
        // Load audio
        await playerRef.current.loadAudio(audioBlob);
        
        setIsLoading(false);

        // Auto play if requested
        if (autoPlay) {
          playerRef.current.play();
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load audio';
        if (onError) {
          onError(new Error(errorMessage));
        } else {
          setError(errorMessage);
        }
        setIsLoading(false);
      }
    };

    initializePlayer();

    // Cleanup on unmount
    return () => {
      if (playerRef.current) {
        playerRef.current.cleanup();
      }
    };
  }, [audioBlob, autoPlay, handleStateChange, handleError]);

  // When an error occurs, build a fallback URL for native audio and clean it up on change/unmount
  useEffect(() => {
    if (!error) return;
    try {
      const url = URL.createObjectURL(audioBlob);
      setFallbackUrl(url);
      return () => {
        try { URL.revokeObjectURL(url); } catch {}
      };
    } catch {}
  }, [error, audioBlob]);

  // Play/pause toggle
  const togglePlayback = useCallback(() => {
    if (!playerRef.current || isLoading) return;

    try {
      if (playbackState.isPlaying) {
        playerRef.current.pause();
        announce('Audio paused', 'polite');
        onPause?.();
      } else {
        playerRef.current.play();
        announce('Audio playing', 'polite');
        onPlay?.();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Playback error';
      announce(`Playback error: ${errorMessage}`, 'assertive');
      setError(errorMessage);
    }
  }, [playbackState.isPlaying, isLoading, onPlay, onPause, announce]);

  // Stop playback
  const stopPlayback = useCallback(() => {
    if (!playerRef.current || isLoading) return;

    try {
      playerRef.current.stop();
      announce('Audio stopped', 'polite');
      onStop?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Stop error';
      announce(`Stop error: ${errorMessage}`, 'assertive');
      setError(errorMessage);
    }
  }, [isLoading, onStop, announce]);

  // Seek to position
  const handleSeek = useCallback((value: number[]) => {
    if (!playerRef.current || isLoading || playbackState.duration === 0) return;

    const seekTime = (value[0] / 100) * playbackState.duration;
    
    try {
      isSeekingRef.current = true;
      playerRef.current.seek(seekTime);
      
      // Reset seeking flag after a short delay
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 100);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Seek error';
      setError(errorMessage);
    }
  }, [playbackState.duration, isLoading]);

  // Volume control
  const handleVolumeChange = useCallback((value: number[]) => {
    if (!playerRef.current || isLoading) return;

    const volume = value[0] / 100;
    
    try {
      playerRef.current.setVolume(volume);
      setIsMuted(volume === 0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Volume error';
      setError(errorMessage);
    }
  }, [isLoading]);

  // Mute/unmute toggle
  const toggleMute = useCallback(() => {
    if (!playerRef.current || isLoading) return;

    try {
      if (isMuted) {
        playerRef.current.setVolume(previousVolume);
        setIsMuted(false);
      } else {
        setPreviousVolume(playbackState.volume);
        playerRef.current.setVolume(0);
        setIsMuted(true);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Mute error';
      setError(errorMessage);
    }
  }, [isMuted, previousVolume, playbackState.volume, isLoading]);

  // Calculate progress percentage
  const progressPercentage = playbackState.duration > 0 
    ? (playbackState.currentTime / playbackState.duration) * 100 
    : 0;

  // Format time display
  const currentTimeFormatted = formatDuration(playbackState.currentTime * 1000);
  const durationFormatted = formatDuration(playbackState.duration * 1000);

  if (error) {
    return (
      <div className={`flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg ${className}`}>
        <audio controls src={fallbackUrl || ''} className="w-full" />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg ${className}`}>
      {/* Live region for announcements */}
      <LiveRegion />
      
      {/* Play/Pause/Stop Controls */}
      <div className="flex items-center gap-1" role="group" aria-label="Audio playback controls">
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePlayback}
          disabled={isLoading}
          aria-label={
            isLoading 
              ? 'Loading audio...' 
              : playbackState.isPlaying 
                ? 'Pause audio' 
                : 'Play audio'
          }
          className="h-8 w-8 p-0"
        >
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500" />
          ) : playbackState.isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={stopPlayback}
          disabled={isLoading || (!playbackState.isPlaying && playbackState.currentTime === 0)}
          aria-label="Stop audio and return to beginning"
          className="h-8 w-8 p-0"
        >
          <Square className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="flex-1 flex items-center gap-2" role="group" aria-label="Audio progress">
        {showTimeDisplay && (
          <span 
            className="text-xs text-gray-500 dark:text-gray-400 min-w-[35px]"
            aria-label={`Current time: ${currentTimeFormatted}`}
          >
            {currentTimeFormatted}
          </span>
        )}
        
        <div className="flex-1">
          <Slider
            value={[progressPercentage]}
            onValueChange={handleSeek}
            disabled={isLoading || playbackState.duration === 0}
            max={100}
            step={0.1}
            aria-label={`Audio progress: ${Math.round(progressPercentage)}% of ${durationFormatted}`}
            className="w-full"
          />
        </div>

        {showTimeDisplay && (
          <span 
            className="text-xs text-gray-500 dark:text-gray-400 min-w-[35px]"
            aria-label={`Total duration: ${durationFormatted}`}
          >
            {durationFormatted}
          </span>
        )}
      </div>

      {/* Volume Control */}
      {showVolumeControl && (
        <div className="flex items-center gap-2 min-w-[100px]" role="group" aria-label="Volume controls">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMute}
            disabled={isLoading}
            aria-label={isMuted || playbackState.volume === 0 ? 'Unmute audio' : 'Mute audio'}
            className="h-8 w-8 p-0"
          >
            {isMuted || playbackState.volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>

          <div className="w-16">
            <Slider
              value={[isMuted ? 0 : playbackState.volume * 100]}
              onValueChange={handleVolumeChange}
              disabled={isLoading}
              max={100}
              step={1}
              aria-label={`Volume: ${Math.round(playbackState.volume * 100)}%`}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Compact version for use in lists
export function CompactAudioPlayer({
  audioBlob,
  className = '',
  onPlay,
  onPause,
  onError
}: Pick<AudioPlayerProps, 'audioBlob' | 'className' | 'onPlay' | 'onPause' | 'onError'>) {
  return (
    <AudioPlayer
      audioBlob={audioBlob}
      className={className}
      showVolumeControl={false}
      showTimeDisplay={false}
      onPlay={onPlay}
      onPause={onPause}
      onError={onError}
    />
  );
}