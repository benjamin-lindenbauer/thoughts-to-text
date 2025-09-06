import { useState, useEffect, useCallback, useRef } from 'react';
import { RecordingState, AudioRecordingOptions } from '@/types';
import { AudioRecorder, AudioCompressor, formatDuration } from '@/lib/audio';

interface UseRecordingOptions extends AudioRecordingOptions {
  autoCompress?: boolean;
  compressionQuality?: number;
  maxDuration?: number; // in milliseconds
}

interface UseRecordingReturn {
  recordingState: RecordingState;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  isSupported: boolean;
  error: string | null;
  formattedDuration: string;
  clearError: () => void;
}

export function useRecording(options: UseRecordingOptions = {}): UseRecordingReturn {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    duration: 0,
    audioBlob: undefined,
    isTranscribing: false,
    transcript: undefined
  });

  const [error, setError] = useState<string | null>(null);
  const [isSupported] = useState(() => AudioRecorder.isSupported());

  const recorderRef = useRef<AudioRecorder | null>(null);
  const compressorRef = useRef<AudioCompressor | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxDurationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize compressor if auto-compression is enabled
  useEffect(() => {
    if (options.autoCompress && !compressorRef.current) {
      compressorRef.current = new AudioCompressor();
    }
    
    return () => {
      if (compressorRef.current) {
        compressorRef.current.cleanup();
        compressorRef.current = null;
      }
    };
  }, [options.autoCompress]);

  // Clean up intervals and timeouts
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (maxDurationTimeoutRef.current) {
        clearTimeout(maxDurationTimeoutRef.current);
      }
    };
  }, []);

  // Clean up recorder on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.cleanup();
      }
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const startDurationTracking = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    durationIntervalRef.current = setInterval(() => {
      if (recorderRef.current) {
        const duration = recorderRef.current.getDuration();
        setRecordingState(prev => ({ ...prev, duration }));
      }
    }, 100);
  }, []);

  const stopDurationTracking = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const handleRecordingComplete = useCallback(async (audioBlob: Blob) => {
    try {
      let finalBlob = audioBlob;

      // Apply compression if enabled
      if (options.autoCompress && compressorRef.current) {
        setRecordingState(prev => ({ ...prev, isTranscribing: true }));
        finalBlob = await compressorRef.current.compressAudio(
          audioBlob, 
          options.compressionQuality || 0.7
        );
      }

      setRecordingState(prev => ({
        ...prev,
        audioBlob: finalBlob,
        isRecording: false,
        isTranscribing: false
      }));

    } catch (compressionError) {
      console.warn('Audio compression failed:', compressionError);
      // Use original blob if compression fails
      setRecordingState(prev => ({
        ...prev,
        audioBlob: audioBlob,
        isRecording: false,
        isTranscribing: false
      }));
    }
  }, [options.autoCompress, options.compressionQuality]);

  const handleStateChange = useCallback((state: 'inactive' | 'recording' | 'paused') => {
    setRecordingState(prev => ({
      ...prev,
      isRecording: state === 'recording'
    }));

    if (state === 'recording') {
      startDurationTracking();
      
      // Set max duration timeout if specified
      if (options.maxDuration) {
        maxDurationTimeoutRef.current = setTimeout(() => {
          stopRecording();
        }, options.maxDuration);
      }
    } else {
      stopDurationTracking();
      
      // Clear max duration timeout
      if (maxDurationTimeoutRef.current) {
        clearTimeout(maxDurationTimeoutRef.current);
        maxDurationTimeoutRef.current = null;
      }
    }
  }, [options.maxDuration]);

  const handleError = useCallback((error: Error) => {
    setError(error.message);
    setRecordingState(prev => ({
      ...prev,
      isRecording: false,
      isTranscribing: false
    }));
    stopDurationTracking();
  }, [stopDurationTracking]);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('Audio recording is not supported in this browser');
      return;
    }

    try {
      setError(null);
      
      // Clean up previous recorder
      if (recorderRef.current) {
        recorderRef.current.cleanup();
      }

      // Create new recorder
      recorderRef.current = new AudioRecorder(
        handleRecordingComplete,
        handleStateChange,
        handleError
      );

      // Initialize and start recording
      await recorderRef.current.initialize(options);
      recorderRef.current.start();

      // Reset state
      setRecordingState(prev => ({
        ...prev,
        duration: 0,
        audioBlob: undefined,
        transcript: undefined
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      setError(errorMessage);
    }
  }, [isSupported, options, handleRecordingComplete, handleStateChange, handleError]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.getState() !== 'inactive') {
      recorderRef.current.stop();
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.getState() === 'recording') {
      recorderRef.current.pause();
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.getState() === 'paused') {
      recorderRef.current.resume();
    }
  }, []);

  const formattedDuration = formatDuration(recordingState.duration);

  return {
    recordingState,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    isSupported,
    error,
    formattedDuration,
    clearError
  };
}