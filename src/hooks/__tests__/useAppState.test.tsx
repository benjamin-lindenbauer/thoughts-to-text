import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import { useAppState, useSettings, useNotes, useRecording, useUI } from '../useAppState';
import { ReactNode } from 'react';

// Mock the storage utilities
vi.mock('@/lib/storage', () => ({
  retrieveSettings: vi.fn().mockResolvedValue(null),
  getAllNotes: vi.fn().mockResolvedValue([]),
  storeSettings: vi.fn().mockResolvedValue(undefined),
  createNote: vi.fn().mockResolvedValue(undefined),
  updateNote: vi.fn().mockResolvedValue(undefined),
  deleteNote: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/state-persistence', () => ({
  StatePersistence: {
    initialize: vi.fn().mockResolvedValue(undefined),
    loadPersistedState: vi.fn().mockReturnValue(null),
    loadOfflineQueue: vi.fn().mockReturnValue({ pendingTranscriptions: [], pendingRewrites: [] }),
    savePersistedState: vi.fn(),
    saveOfflineQueue: vi.fn(),
  }
}));

// Test wrapper component
function TestWrapper({ children }: { children: ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

describe('useAppState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide initial state', async () => {
    const { result } = renderHook(() => useAppState(), {
      wrapper: TestWrapper,
    });

    expect(result.current.state).toBeDefined();
    expect(result.current.settings).toBeDefined();
    expect(result.current.notes).toBeDefined();
    expect(result.current.recording).toBeDefined();
    expect(result.current.ui).toBeDefined();
    expect(result.current.offlineQueue).toBeDefined();
  });
});

describe('useSettings', () => {
  it('should provide settings functionality', async () => {
    const { result } = renderHook(() => useSettings(), {
      wrapper: TestWrapper,
    });

    expect(result.current.settings).toBeDefined();
    expect(result.current.updateSettings).toBeDefined();
    expect(result.current.addRewritePrompt).toBeDefined();
    expect(result.current.updateRewritePrompt).toBeDefined();
    expect(result.current.deleteRewritePrompt).toBeDefined();
  });

  it('should have default settings', async () => {
    const { result } = renderHook(() => useSettings(), {
      wrapper: TestWrapper,
    });

    expect(result.current.settings.theme).toBe('auto');
    expect(result.current.settings.defaultLanguage).toBe('en');
    expect(result.current.settings.rewritePrompts).toHaveLength(1);
    expect(result.current.settings.rewritePrompts[0].name).toBe('Improve and Structure');
  });
});

describe('useNotes', () => {
  it('should provide notes functionality', async () => {
    const { result } = renderHook(() => useNotes(), {
      wrapper: TestWrapper,
    });

    expect(result.current.notes).toEqual([]);
    expect(result.current.addNote).toBeDefined();
    expect(result.current.updateNote).toBeDefined();
    expect(result.current.deleteNote).toBeDefined();
    expect(result.current.selectNote).toBeDefined();
    expect(result.current.searchNotes).toBeDefined();
  });
});

describe('useRecording', () => {
  it('should provide recording functionality', async () => {
    const { result } = renderHook(() => useRecording(), {
      wrapper: TestWrapper,
    });

    expect(result.current.recording.isRecording).toBe(false);
    expect(result.current.recording.duration).toBe(0);
    expect(result.current.startRecording).toBeDefined();
    expect(result.current.stopRecording).toBeDefined();
    expect(result.current.updateDuration).toBeDefined();
  });

  it('should handle recording state changes', async () => {
    const { result } = renderHook(() => useRecording(), {
      wrapper: TestWrapper,
    });

    act(() => {
      result.current.startRecording();
    });

    expect(result.current.recording.isRecording).toBe(true);

    const mockBlob = new Blob(['test'], { type: 'audio/wav' });
    act(() => {
      result.current.stopRecording(mockBlob, 30);
    });

    expect(result.current.recording.isRecording).toBe(false);
    expect(result.current.recording.duration).toBe(30);
    expect(result.current.recording.audioBlob).toBe(mockBlob);
  });
});

describe('useUI', () => {
  it('should provide UI state functionality', async () => {
    const { result } = renderHook(() => useUI(), {
      wrapper: TestWrapper,
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.setLoading).toBeDefined();
    expect(result.current.setError).toBeDefined();
    expect(result.current.clearError).toBeDefined();
  });

  it('should handle UI state changes', async () => {
    const { result } = renderHook(() => useUI(), {
      wrapper: TestWrapper,
    });

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.setError('Test error');
    });

    expect(result.current.error).toBe('Test error');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBe(null);
  });
});