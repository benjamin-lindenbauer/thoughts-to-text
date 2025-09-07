import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import RecordingInterface from '@/components/RecordingInterface';

// Mock MediaRecorder
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  state: 'inactive',
  stream: null,
  mimeType: 'audio/webm',
  ondataavailable: null,
  onerror: null,
  onpause: null,
  onresume: null,
  onstart: null,
  onstop: null,
};

global.MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder);
(global.MediaRecorder as any).isTypeSupported = vi.fn().mockReturnValue(true);

// Mock getUserMedia
const mockGetUserMedia = vi.fn();
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
    enumerateDevices: vi.fn().mockResolvedValue([
      { kind: 'audioinput', deviceId: 'default', label: 'Default Microphone' }
    ]),
  },
});

// Mock fetch for API calls
global.fetch = vi.fn();

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <AppProvider>
      {children}
    </AppProvider>
  </ThemeProvider>
);

describe('Recording Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should complete full recording and transcription flow', async () => {
    // Mock successful transcription
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transcript: 'This is a test transcription',
        language: 'en',
      }),
    } as Response);

    render(
      <TestWrapper>
        <RecordingInterface />
      </TestWrapper>
    );

    // Start recording
    const recordButton = screen.getByRole('button', { name: /start recording/i });
    fireEvent.click(recordButton);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    });

    // Simulate recording state
    mockMediaRecorder.state = 'recording';
    
    // Stop recording
    const stopButton = screen.getByRole('button', { name: /stop recording/i });
    fireEvent.click(stopButton);

    // Simulate dataavailable event
    const audioBlob = new Blob(['audio data'], { type: 'audio/webm' });
    if (mockMediaRecorder.ondataavailable) {
      mockMediaRecorder.ondataavailable({ data: audioBlob } as any);
    }

    // Simulate stop event
    if (mockMediaRecorder.onstop) {
      mockMediaRecorder.onstop({} as any);
    }

    // Wait for transcription to complete
    await waitFor(() => {
      expect(screen.getByText('This is a test transcription')).toBeInTheDocument();
    });

    // Verify API was called with correct data
    expect(mockFetch).toHaveBeenCalledWith('/api/transcribe', {
      method: 'POST',
      headers: expect.objectContaining({
        'x-openai-api-key': expect.any(String),
      }),
      body: expect.any(FormData),
    });
  });

  it('should handle recording errors gracefully', async () => {
    // Mock getUserMedia failure
    mockGetUserMedia.mockRejectedValueOnce(new Error('Microphone access denied'));

    render(
      <TestWrapper>
        <RecordingInterface />
      </TestWrapper>
    );

    const recordButton = screen.getByRole('button', { name: /start recording/i });
    fireEvent.click(recordButton);

    await waitFor(() => {
      expect(screen.getByText(/microphone access/i)).toBeInTheDocument();
    });
  });

  it('should handle transcription errors with retry', async () => {
    const mockFetch = vi.mocked(fetch);
    
    // First call fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({
        error: 'Service unavailable',
        type: 'server',
        retryable: true,
      }),
    } as Response);

    // Second call succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transcript: 'Transcription after retry',
        language: 'en',
      }),
    } as Response);

    render(
      <TestWrapper>
        <RecordingInterface />
      </TestWrapper>
    );

    // Complete recording flow
    const recordButton = screen.getByRole('button', { name: /start recording/i });
    fireEvent.click(recordButton);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });

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

    // Wait for retry and success
    await waitFor(() => {
      expect(screen.getByText('Transcription after retry')).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should save recording with metadata to storage', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transcript: 'Test transcript for storage',
        language: 'en',
      }),
    } as Response);

    render(
      <TestWrapper>
        <RecordingInterface />
      </TestWrapper>
    );

    // Complete recording
    const recordButton = screen.getByRole('button', { name: /start recording/i });
    fireEvent.click(recordButton);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });

    const stopButton = screen.getByRole('button', { name: /stop recording/i });
    fireEvent.click(stopButton);

    // Simulate recording data
    const audioBlob = new Blob(['audio data'], { type: 'audio/webm' });
    if (mockMediaRecorder.ondataavailable) {
      mockMediaRecorder.ondataavailable({ data: audioBlob } as any);
    }
    if (mockMediaRecorder.onstop) {
      mockMediaRecorder.onstop({} as any);
    }

    await waitFor(() => {
      expect(screen.getByText('Test transcript for storage')).toBeInTheDocument();
    });

    // Verify note was saved (check localStorage mock)
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('should handle different audio formats', async () => {
    const formats = ['audio/webm', 'audio/mp4', 'audio/wav'];
    
    for (const format of formats) {
      (global.MediaRecorder as any).isTypeSupported.mockImplementation(
        (type: string) => type === format
      );

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcript: `Transcription for ${format}`,
          language: 'en',
        }),
      } as Response);

      render(
        <TestWrapper>
          <RecordingInterface />
        </TestWrapper>
      );

      const recordButton = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(recordButton);

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      // Verify correct format is used
      expect(global.MediaRecorder).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          mimeType: format,
        })
      );
    }
  });
});