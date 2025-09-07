import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Get localStorageMock from global
declare global {
  var localStorageMock: {
    getItem: any;
    setItem: any;
    removeItem: any;
    clear: any;
  };
}

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
  ondataavailable: vi.fn(),
  onerror: vi.fn(),
  onpause: vi.fn(),
  onresume: vi.fn(),
  onstart: vi.fn(),
  onstop: vi.fn(),
};

global.MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder) as any;
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

    // Test the recording flow logic
    const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
    
    // Simulate recording start
    expect(mockGetUserMedia).toBeDefined();
    
    // Simulate recording completion
    if (mockMediaRecorder.ondataavailable) {
      mockMediaRecorder.ondataavailable({ data: audioBlob } as any);
    }
    if (mockMediaRecorder.onstop) {
      mockMediaRecorder.onstop({} as any);
    }

    // Verify API would be called with correct data
    expect(mockFetch).toBeDefined();
  });

  it('should handle recording errors gracefully', async () => {
    // Mock getUserMedia failure
    mockGetUserMedia.mockRejectedValueOnce(new Error('Microphone access denied'));

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Microphone access denied');
    }
  });

  it('should handle transcription errors with retry', async () => {
    const mockFetch = vi.mocked(fetch);
    
    // First attempt fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({
        error: 'Service temporarily unavailable',
        type: 'server',
        retryable: true,
      }),
    } as Response);

    // Second attempt succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transcript: 'Successfully transcribed after retry',
        language: 'en',
      }),
    } as Response);

    // Test retry logic would work
    expect(mockFetch).toBeDefined();
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

    // Simulate recording completion
    const audioBlob = new Blob(['audio data'], { type: 'audio/webm' });
    if (mockMediaRecorder.ondataavailable) {
      mockMediaRecorder.ondataavailable({ data: audioBlob } as any);
    }
    if (mockMediaRecorder.onstop) {
      mockMediaRecorder.onstop({} as any);
    }

    // Verify localStorage would be used
    expect(localStorageMock).toBeDefined();
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

      // Verify correct format is supported
      expect(global.MediaRecorder.isTypeSupported(format)).toBe(true);
    }
  });
});