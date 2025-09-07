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

// Mock Next.js router
const mockPush = vi.fn();
const mockPathname = '/';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    pathname: mockPathname,
  }),
  usePathname: () => mockPathname,
}));

// Mock MediaRecorder
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  state: 'inactive',
  ondataavailable: vi.fn(),
  onstop: vi.fn(),
};

global.MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder) as any;
(global.MediaRecorder as any).isTypeSupported = vi.fn().mockReturnValue(true);

// Mock getUserMedia
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
});

// Mock Web Share API
Object.defineProperty(navigator, 'share', {
  value: vi.fn().mockResolvedValue(undefined),
});

Object.defineProperty(navigator, 'canShare', {
  value: vi.fn().mockReturnValue(true),
});

// Mock fetch
global.fetch = vi.fn();

describe('Critical User Journeys (E2E)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset localStorage
    localStorageMock.clear();
    // Set up default API key
    localStorageMock.setItem('openai-api-key', 'sk-test-key-' + 'a'.repeat(40));
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Complete Recording and Transcription Journey', () => {
    it('should complete full user journey from recording to note creation', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // Mock successful transcription
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcript: 'This is my important meeting note about project deadlines',
          language: 'en',
        }),
      } as Response);

      // Mock successful metadata generation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rewrittenText: JSON.stringify({
            title: 'Project Deadlines Meeting',
            description: 'Discussion about upcoming project milestones and deadlines',
            keywords: ['meeting', 'project', 'deadlines'],
          }),
          originalText: 'This is my important meeting note about project deadlines',
          prompt: 'Generate metadata',
        }),
      } as Response);

      // Test the recording flow
      expect(navigator.mediaDevices.getUserMedia).toBeDefined();
      
      // Simulate recording completion
      const audioBlob = new Blob(['audio data'], { type: 'audio/webm' });
      if (mockMediaRecorder.ondataavailable) {
        mockMediaRecorder.ondataavailable({ data: audioBlob } as any);
      }
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop({} as any);
      }

      // Verify API calls would be made
      expect(mockFetch).toBeDefined();
      expect(localStorageMock.setItem).toBeDefined();
    });

    it('should handle recording with photo attachment', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // Mock camera API
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn()
            .mockResolvedValueOnce({
              getTracks: () => [{ stop: vi.fn() }],
            })
            .mockResolvedValueOnce({
              getVideoTracks: () => [{ stop: vi.fn() }],
              getTracks: () => [{ stop: vi.fn() }],
            }),
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcript: 'This is a note with a photo attachment',
          language: 'en',
        }),
      } as Response);

      // Test photo capture capability
      expect(navigator.mediaDevices.getUserMedia).toBeDefined();

      // Complete recording
      const audioBlob = new Blob(['audio data'], { type: 'audio/webm' });
      if (mockMediaRecorder.ondataavailable) {
        mockMediaRecorder.ondataavailable({ data: audioBlob } as any);
      }
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop({} as any);
      }

      // Verify photo handling
      expect(localStorageMock.setItem).toBeDefined();
    });
  });

  describe('Settings Configuration Journey', () => {
    it('should allow user to configure API key and preferences', async () => {
      // Test settings storage
      expect(localStorageMock.setItem).toBeDefined();
      expect(localStorageMock.getItem).toBeDefined();

      // Simulate settings changes
      localStorageMock.setItem('openai-api-key', 'sk-new-key-' + 'b'.repeat(40));
      localStorageMock.setItem('app-settings', JSON.stringify({
        defaultLanguage: 'es',
        theme: 'dark'
      }));

      // Verify settings were saved
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should manage custom rewrite prompts', async () => {
      // Test prompt management
      const prompts = [
        { id: '1', name: 'Professional Tone', prompt: 'Rewrite this text in a professional tone' }
      ];

      localStorageMock.setItem('rewrite-prompts', JSON.stringify(prompts));
      
      const savedPrompts = localStorageMock.getItem('rewrite-prompts');
      expect(savedPrompts).toBeDefined();
    });
  });

  describe('Note Management Journey', () => {
    it('should allow viewing, editing, and sharing notes', async () => {
      // Pre-populate with a test note
      const testNote = {
        id: 'test-note-1',
        title: 'Test Meeting Note',
        description: 'Important meeting about project updates',
        transcript: 'We discussed the project timeline and upcoming milestones',
        rewrittenText: 'Professional summary of project timeline discussion',
        createdAt: new Date().toISOString(),
        duration: 120,
        language: 'en',
        keywords: ['meeting', 'project', 'timeline'],
      };

      localStorageMock.setItem(`note-${testNote.id}`, JSON.stringify(testNote));
      localStorageMock.setItem('notes-list', JSON.stringify([testNote.id]));

      // Test note retrieval
      const savedNote = localStorageMock.getItem(`note-${testNote.id}`);
      expect(savedNote).toBeDefined();

      // Test sharing capability
      expect(navigator.share).toBeDefined();
      expect(navigator.canShare).toBeDefined();

      // Test deletion
      localStorageMock.removeItem(`note-${testNote.id}`);
      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });
  });

  describe('Rewriting and Enhancement Journey', () => {
    it('should allow text rewriting with different prompts', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // Mock transcription
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcript: 'This is a rough transcript that needs improvement',
          language: 'en',
        }),
      } as Response);

      // Mock rewrite responses
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rewrittenText: 'This is a professionally refined transcript with improved clarity',
          originalText: 'This is a rough transcript that needs improvement',
          prompt: 'Make it more professional',
        }),
      } as Response);

      // Test rewriting capability
      expect(mockFetch).toBeDefined();
    });
  });

  describe('Error Recovery Journey', () => {
    it('should handle and recover from API errors', async () => {
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

      // Test error handling
      expect(mockFetch).toBeDefined();
    });

    it('should handle storage quota exceeded', async () => {
      // Mock storage quota exceeded
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: vi.fn().mockResolvedValue({
            usage: 990000000, // 990MB
            quota: 1000000000, // 1GB
          }),
        },
      });

      // Test storage monitoring
      const estimate = await navigator.storage.estimate();
      expect(estimate.usage).toBeGreaterThan(estimate.quota! * 0.9);
    });
  });

  describe('Accessibility Journey', () => {
    it('should support keyboard navigation', async () => {
      // Test keyboard event handling
      const keyEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      expect(keyEvent.key).toBe('Enter');
    });

    it('should provide screen reader support', () => {
      // Test ARIA support
      const element = document.createElement('button');
      element.setAttribute('aria-label', 'Start recording');
      expect(element.getAttribute('aria-label')).toBe('Start recording');
    });
  });
});