import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import RecordingInterface from '@/components/RecordingInterface';
import OfflineIndicator from '@/components/OfflineIndicator';

// Mock service worker
const mockServiceWorker = {
  register: vi.fn(),
  unregister: vi.fn(),
  update: vi.fn(),
  addEventListener: vi.fn(),
  postMessage: vi.fn(),
};

Object.defineProperty(navigator, 'serviceWorker', {
  value: mockServiceWorker,
});

// Mock online/offline events
const mockNavigator = {
  onLine: true,
};

Object.defineProperty(navigator, 'onLine', {
  get: () => mockNavigator.onLine,
  configurable: true,
});

// Mock MediaRecorder for offline recording
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  state: 'inactive',
  ondataavailable: null,
  onstop: null,
};

global.MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder);
(global.MediaRecorder as any).isTypeSupported = vi.fn().mockReturnValue(true);

// Mock getUserMedia
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
});

// Mock fetch
global.fetch = vi.fn();

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <AppProvider>
      {children}
    </AppProvider>
  </ThemeProvider>
);

describe('Offline Functionality Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigator.onLine = true;
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should detect offline status and show indicator', async () => {
    render(
      <TestWrapper>
        <OfflineIndicator />
      </TestWrapper>
    );

    // Initially online
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();

    // Go offline
    mockNavigator.onLine = false;
    fireEvent(window, new Event('offline'));

    await waitFor(() => {
      expect(screen.getByText(/offline/i)).toBeInTheDocument();
    });

    // Go back online
    mockNavigator.onLine = true;
    fireEvent(window, new Event('online'));

    await waitFor(() => {
      expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
    });
  });

  it('should allow recording while offline', async () => {
    // Set offline state
    mockNavigator.onLine = false;

    render(
      <TestWrapper>
        <RecordingInterface />
      </TestWrapper>
    );

    const recordButton = screen.getByRole('button', { name: /start recording/i });
    
    // Should still be able to start recording
    fireEvent.click(recordButton);

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });

    // Complete recording
    const stopButton = screen.getByRole('button', { name: /stop recording/i });
    fireEvent.click(stopButton);

    // Simulate recording completion
    const audioBlob = new Blob(['audio data'], { type: 'audio/webm' });
    if (mockMediaRecorder.ondataavailable) {
      mockMediaRecorder.ondataavailable({ data: audioBlob } as any);
    }
    if (mockMediaRecorder.onstop) {
      mockMediaRecorder.onstop({} as any);
    }

    // Should show offline message instead of transcribing
    await waitFor(() => {
      expect(screen.getByText(/will be transcribed when you're back online/i)).toBeInTheDocument();
    });

    // Verify recording was saved locally
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('should queue transcription requests when offline', async () => {
    const mockFetch = vi.mocked(fetch);
    
    // Start offline
    mockNavigator.onLine = false;

    render(
      <TestWrapper>
        <RecordingInterface />
      </TestWrapper>
    );

    // Complete a recording while offline
    const recordButton = screen.getByRole('button', { name: /start recording/i });
    fireEvent.click(recordButton);

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });

    const stopButton = screen.getByRole('button', { name: /stop recording/i });
    fireEvent.click(stopButton);

    const audioBlob = new Blob(['audio data'], { type: 'audio/webm' });
    if (mockMediaRecorder.ondataavailable) {
      mockMediaRecorder.ondataavailable({ data: audioBlob } as any);
    }
    if (mockMediaRecorder.onstop) {
      mockMediaRecorder.onstop({} as any);
    }

    // No API calls should be made while offline
    expect(mockFetch).not.toHaveBeenCalled();

    // Go back online
    mockNavigator.onLine = true;
    fireEvent(window, new Event('online'));

    // Mock successful transcription
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transcript: 'Transcription after coming back online',
        language: 'en',
      }),
    } as Response);

    // Should automatically process queued requests
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/transcribe', expect.any(Object));
    }, { timeout: 5000 });
  });

  it('should handle service worker registration', async () => {
    mockServiceWorker.register.mockResolvedValueOnce({
      installing: null,
      waiting: null,
      active: { state: 'activated' },
      addEventListener: vi.fn(),
    } as any);

    // Import and test PWA initialization
    const { initializePWA } = await import('@/lib/pwa');
    
    await initializePWA();

    expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js');
  });

  it('should cache resources for offline use', async () => {
    // Mock cache API
    const mockCache = {
      add: vi.fn(),
      addAll: vi.fn(),
      match: vi.fn(),
      put: vi.fn(),
    };

    const mockCaches = {
      open: vi.fn().mockResolvedValue(mockCache),
      match: vi.fn(),
    };

    Object.defineProperty(global, 'caches', {
      value: mockCaches,
    });

    // Test cache initialization
    const { cacheResources } = await import('@/lib/pwa');
    
    await cacheResources();

    expect(mockCaches.open).toHaveBeenCalledWith(expect.stringContaining('thoughts-to-text'));
    expect(mockCache.addAll).toHaveBeenCalledWith(expect.arrayContaining([
      '/',
      '/notes',
      '/settings',
    ]));
  });

  it('should sync data when coming back online', async () => {
    const mockFetch = vi.mocked(fetch);
    
    // Start offline with queued data
    mockNavigator.onLine = false;
    
    // Mock queued transcription data in localStorage
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'transcription-queue') {
        return JSON.stringify([
          {
            id: 'test-1',
            audioBlob: 'blob-data',
            language: 'en',
            timestamp: Date.now(),
          }
        ]);
      }
      return null;
    });

    render(
      <TestWrapper>
        <div>Test Component</div>
      </TestWrapper>
    );

    // Go online
    mockNavigator.onLine = true;
    
    // Mock successful sync
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transcript: 'Synced transcription',
        language: 'en',
      }),
    } as Response);

    fireEvent(window, new Event('online'));

    // Should process queued items
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Queue should be cleared after successful sync
    expect(localStorageMock.setItem).toHaveBeenCalledWith('transcription-queue', '[]');
  });

  it('should handle partial sync failures', async () => {
    const mockFetch = vi.mocked(fetch);
    
    // Mock queued data with multiple items
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'transcription-queue') {
        return JSON.stringify([
          { id: 'test-1', audioBlob: 'blob-1', language: 'en' },
          { id: 'test-2', audioBlob: 'blob-2', language: 'en' },
          { id: 'test-3', audioBlob: 'blob-3', language: 'en' },
        ]);
      }
      return null;
    });

    mockNavigator.onLine = false;

    render(
      <TestWrapper>
        <div>Test Component</div>
      </TestWrapper>
    );

    // Go online
    mockNavigator.onLine = true;

    // First request succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ transcript: 'Success 1', language: 'en' }),
    } as Response);

    // Second request fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: 'Service unavailable', type: 'server', retryable: true }),
    } as Response);

    // Third request succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ transcript: 'Success 3', language: 'en' }),
    } as Response);

    fireEvent(window, new Event('online'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    // Failed item should remain in queue
    const queueCalls = localStorageMock.setItem.mock.calls.filter(
      call => call[0] === 'transcription-queue'
    );
    const finalQueue = JSON.parse(queueCalls[queueCalls.length - 1][1]);
    expect(finalQueue).toHaveLength(1);
    expect(finalQueue[0].id).toBe('test-2');
  });

  it('should show appropriate offline messages', async () => {
    mockNavigator.onLine = false;

    render(
      <TestWrapper>
        <RecordingInterface />
        <OfflineIndicator />
      </TestWrapper>
    );

    // Should show offline indicator
    expect(screen.getByText(/offline/i)).toBeInTheDocument();

    // Complete a recording
    const recordButton = screen.getByRole('button', { name: /start recording/i });
    fireEvent.click(recordButton);

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });

    const stopButton = screen.getByRole('button', { name: /stop recording/i });
    fireEvent.click(stopButton);

    const audioBlob = new Blob(['audio data'], { type: 'audio/webm' });
    if (mockMediaRecorder.ondataavailable) {
      mockMediaRecorder.ondataavailable({ data: audioBlob } as any);
    }
    if (mockMediaRecorder.onstop) {
      mockMediaRecorder.onstop({} as any);
    }

    // Should show offline-specific message
    await waitFor(() => {
      expect(screen.getByText(/will be transcribed when you're back online/i)).toBeInTheDocument();
    });
  });
});