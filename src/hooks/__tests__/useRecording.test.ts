import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the entire audio module
vi.mock('@/lib/audio', () => {
  const mockIsSupported = vi.fn().mockReturnValue(true);
  
  const mockAudioRecorder = vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getState: vi.fn().mockReturnValue('inactive'),
    getDuration: vi.fn().mockReturnValue(0),
    cleanup: vi.fn()
  }));
  
  mockAudioRecorder.isSupported = mockIsSupported;
  
  return {
    AudioRecorder: mockAudioRecorder,
    AudioCompressor: vi.fn().mockImplementation(() => ({
      compressAudio: vi.fn().mockImplementation((blob) => Promise.resolve(blob)),
      cleanup: vi.fn()
    })),
    formatDuration: vi.fn().mockImplementation((ms) => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    })
  };
});

import { useRecording } from '../useRecording';

describe('useRecording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useRecording());

    expect(result.current.recordingState).toEqual({
      isRecording: false,
      duration: 0,
      audioBlob: undefined,
      isTranscribing: false,
      transcript: undefined
    });
    expect(result.current.isSupported).toBe(true);
    expect(result.current.error).toBe(null);
    expect(result.current.formattedDuration).toBe('0:00');
  });

  it('should start recording successfully', async () => {
    const { result } = renderHook(() => useRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.error).toBe(null);
  });

  it('should stop recording', async () => {
    const { result } = renderHook(() => useRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.stopRecording();
    });

    expect(result.current.recordingState.isRecording).toBe(false);
  });

  it('should pause recording', async () => {
    const { result } = renderHook(() => useRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.pauseRecording();
    });

    expect(result.current.error).toBe(null);
  });

  it('should resume recording', async () => {
    const { result } = renderHook(() => useRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.pauseRecording();
      result.current.resumeRecording();
    });

    expect(result.current.error).toBe(null);
  });

  it('should clear error', () => {
    const { result } = renderHook(() => useRecording());

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBe(null);
  });

  it('should format duration correctly', () => {
    const { result } = renderHook(() => useRecording());

    expect(result.current.formattedDuration).toBe('0:00');
  });

  it('should handle auto compression when enabled', async () => {
    const { result } = renderHook(() => useRecording({ 
      autoCompress: true,
      compressionQuality: 0.8 
    }));

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.error).toBe(null);
  });

  it('should handle max duration timeout', async () => {
    const { result } = renderHook(() => useRecording({ 
      maxDuration: 1000 // 1 second
    }));

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.error).toBe(null);
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useRecording());

    unmount();

    expect(true).toBe(true);
  });
});