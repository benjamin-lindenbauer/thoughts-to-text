import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { transcribeAudio, rewriteText, generateNoteMetadata } from '@/lib/api';

// Mock error logging
vi.mock('@/lib/error-logging', () => ({
  errorLogger: {
    info: vi.fn(),
    error: vi.fn(),
    handleAPIError: vi.fn(),
    handleNetworkError: vi.fn(),
  }
}));

// Mock fetch globally
global.fetch = vi.fn();

// Mock setTimeout for retry logic
vi.mock('global', () => ({
  setTimeout: vi.fn((fn, delay) => {
    fn();
    return 1;
  })
}));

describe('API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('transcribeAudio', () => {
    it('should successfully transcribe audio', async () => {
      const mockResponse = {
        transcript: 'Hello world, this is a test transcription.',
        language: 'en',
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const audioBlob = new Blob(['test audio data'], { type: 'audio/webm' });
      const result = await transcribeAudio(audioBlob, 'en', 'sk-test-key-123');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/transcribe', {
        method: 'POST',
        headers: {
          'x-openai-api-key': 'sk-test-key-123',
        },
        body: expect.any(FormData),
      });

      // Verify FormData contains correct fields
      const formData = mockFetch.mock.calls[0][1]?.body as FormData;
      expect(formData.get('language')).toBe('en');
      expect(formData.get('audio')).toBeInstanceOf(Blob);
    });

    it('should handle different languages', async () => {
      const mockResponse = {
        transcript: 'Bonjour le monde',
        language: 'fr',
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
      const result = await transcribeAudio(audioBlob, 'fr', 'sk-test-key');

      expect(result.language).toBe('fr');
      const formData = mockFetch.mock.calls[0][1]?.body as FormData;
      expect(formData.get('language')).toBe('fr');
    });

    it('should handle authentication errors (401)', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'Invalid API key',
          type: 'auth',
          retryable: false,
        }),
      } as Response);

      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
      
      await expect(transcribeAudio(audioBlob, 'en', 'invalid-key')).rejects.toMatchObject({
        type: 'auth',
        message: 'Invalid API key',
        retryable: false,
      });

      // Should not retry auth errors
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle rate limit errors (429) with retry', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // First call fails with rate limit
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: 'Rate limit exceeded',
          type: 'quota',
          retryable: true,
          retryAfter: 2,
        }),
      } as Response);

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcript: 'Hello world',
          language: 'en',
        }),
      } as Response);

      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
      
      const promise = transcribeAudio(audioBlob, 'en', 'sk-test-key');
      
      // Fast-forward timers to trigger retry
      vi.advanceTimersByTime(2000);
      
      const result = await promise;

      expect(result.transcript).toBe('Hello world');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle server errors (500) with retry', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // First call fails with server error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Internal server error',
          type: 'server',
          retryable: true,
        }),
      } as Response);

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcript: 'Hello world',
          language: 'en',
        }),
      } as Response);

      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
      
      const promise = transcribeAudio(audioBlob, 'en', 'sk-test-key');
      
      // Fast-forward timers to trigger retry
      vi.advanceTimersByTime(1000);
      
      const result = await promise;

      expect(result.transcript).toBe('Hello world');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle network errors with retry', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // First call fails with network error
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcript: 'Hello world',
          language: 'en',
        }),
      } as Response);

      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
      
      const promise = transcribeAudio(audioBlob, 'en', 'sk-test-key');
      
      // Fast-forward timers to trigger retry
      vi.advanceTimersByTime(1000);
      
      const result = await promise;

      expect(result.transcript).toBe('Hello world');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should stop retrying after max attempts', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // All calls fail with retryable error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({
          error: 'Service unavailable',
          type: 'server',
          retryable: true,
        }),
      } as Response);

      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
      
      const promise = transcribeAudio(audioBlob, 'en', 'sk-test-key');
      
      // Fast-forward timers to trigger all retries
      vi.advanceTimersByTime(20000);
      
      await expect(promise).rejects.toMatchObject({
        type: 'server',
        message: 'Service unavailable',
      });

      // Should try initial + 3 retries = 4 total
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should handle malformed error responses', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as Response);

      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
      
      await expect(transcribeAudio(audioBlob, 'en', 'sk-test-key')).rejects.toMatchObject({
        type: 'unknown',
        message: 'HTTP 500: Internal Server Error',
        retryable: true,
      });
    });
  });

  describe('rewriteText', () => {
    it('should successfully rewrite text', async () => {
      const mockResponse = {
        rewrittenText: 'This is an improved and more professional version of the text.',
        originalText: 'This is some text that needs improvement.',
        prompt: 'Make it more professional',
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await rewriteText(
        'This is some text that needs improvement.',
        'Make it more professional',
        'sk-test-key-456'
      );

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-api-key': 'sk-test-key-456',
        },
        body: JSON.stringify({
          text: 'This is some text that needs improvement.',
          prompt: 'Make it more professional',
        }),
      });
    });

    it('should handle different rewrite prompts', async () => {
      const prompts = [
        'Make it more casual',
        'Summarize this text',
        'Translate to French',
        'Fix grammar and spelling',
      ];

      for (const prompt of prompts) {
        const mockFetch = vi.mocked(fetch);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            rewrittenText: `Rewritten with: ${prompt}`,
            originalText: 'Original text',
            prompt: prompt,
          }),
        } as Response);

        const result = await rewriteText('Original text', prompt, 'sk-test-key');
        
        expect(result.prompt).toBe(prompt);
        expect(result.rewrittenText).toContain(prompt);
      }
    });

    it('should handle authentication errors (401)', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'Invalid API key',
          type: 'auth',
          retryable: false,
        }),
      } as Response);

      await expect(rewriteText('text', 'prompt', 'invalid-key')).rejects.toMatchObject({
        type: 'auth',
        message: 'Invalid API key',
        retryable: false,
      });

      // Should not retry auth errors
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle rate limit errors with custom retry-after', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // First call fails with rate limit and custom retry-after
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: 'Rate limit exceeded',
          type: 'quota',
          retryable: true,
          retryAfter: 5,
        }),
      } as Response);

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rewrittenText: 'Rewritten text',
          originalText: 'Original text',
          prompt: 'Test prompt',
        }),
      } as Response);

      const promise = rewriteText('Original text', 'Test prompt', 'sk-test-key');
      
      // Fast-forward timers to trigger retry after 5 seconds
      vi.advanceTimersByTime(5000);
      
      const result = await promise;

      expect(result.rewrittenText).toBe('Rewritten text');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle empty or invalid responses', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rewrittenText: '',
          originalText: 'Original text',
          prompt: 'Test prompt',
        }),
      } as Response);

      const result = await rewriteText('Original text', 'Test prompt', 'sk-test-key');
      
      expect(result.rewrittenText).toBe('');
      expect(result.originalText).toBe('Original text');
    });

    it('should handle network timeouts', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // Simulate network timeout
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rewrittenText: 'Rewritten text',
          originalText: 'Original text',
          prompt: 'Test prompt',
        }),
      } as Response);

      const promise = rewriteText('Original text', 'Test prompt', 'sk-test-key');
      
      // Fast-forward timers to trigger retry
      vi.advanceTimersByTime(1000);
      
      const result = await promise;

      expect(result.rewrittenText).toBe('Rewritten text');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateNoteMetadata', () => {
    it('should generate metadata from transcript with valid JSON', async () => {
      const mockResponse = {
        rewrittenText: JSON.stringify({
          title: 'Weekly Team Meeting',
          description: 'Discussion about project milestones and upcoming deadlines',
          keywords: ['meeting', 'project', 'deadlines', 'team', 'milestones'],
        }),
        originalText: 'We had our weekly team meeting today to discuss project milestones and upcoming deadlines.',
        prompt: expect.stringContaining('generate'),
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await generateNoteMetadata(
        'We had our weekly team meeting today to discuss project milestones and upcoming deadlines.',
        'sk-test-key'
      );

      expect(result).toEqual({
        title: 'Weekly Team Meeting',
        description: 'Discussion about project milestones and upcoming deadlines',
        keywords: ['meeting', 'project', 'deadlines', 'team', 'milestones'],
      });

      // Verify the prompt includes metadata generation instructions
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(requestBody.prompt).toContain('title');
      expect(requestBody.prompt).toContain('description');
      expect(requestBody.prompt).toContain('keywords');
      expect(requestBody.prompt).toContain('JSON');
    });

    it('should fallback to simple metadata if JSON parsing fails', async () => {
      const transcript = 'This is a long transcript that should be truncated properly when used as fallback metadata';
      
      const mockResponse = {
        rewrittenText: 'Invalid JSON response that cannot be parsed',
        originalText: transcript,
        prompt: expect.any(String),
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await generateNoteMetadata(transcript, 'sk-test-key');

      expect(result.title).toBe(transcript.slice(0, 50) + '...');
      expect(result.description).toBe(transcript.slice(0, 150));
      expect(result.keywords).toEqual([]);
    });

    it('should handle short transcripts without truncation', async () => {
      const shortTranscript = 'Short note';
      
      const mockResponse = {
        rewrittenText: 'Not valid JSON',
        originalText: shortTranscript,
        prompt: expect.any(String),
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await generateNoteMetadata(shortTranscript, 'sk-test-key');

      expect(result.title).toBe(shortTranscript);
      expect(result.description).toBe(shortTranscript);
      expect(result.keywords).toEqual([]);
    });

    it('should handle partial JSON metadata', async () => {
      const mockResponse = {
        rewrittenText: JSON.stringify({
          title: 'Valid Title',
          // Missing description and keywords
        }),
        originalText: 'Test transcript',
        prompt: expect.any(String),
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await generateNoteMetadata('Test transcript', 'sk-test-key');

      expect(result.title).toBe('Valid Title');
      expect(result.description).toBe('No description available');
      expect(result.keywords).toEqual([]);
    });

    it('should handle invalid keywords format', async () => {
      const mockResponse = {
        rewrittenText: JSON.stringify({
          title: 'Test Title',
          description: 'Test Description',
          keywords: 'not an array', // Invalid format
        }),
        originalText: 'Test transcript',
        prompt: expect.any(String),
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await generateNoteMetadata('Test transcript', 'sk-test-key');

      expect(result.title).toBe('Test Title');
      expect(result.description).toBe('Test Description');
      expect(result.keywords).toEqual([]);
    });

    it('should handle API errors with retry', async () => {
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
          rewrittenText: JSON.stringify({
            title: 'Generated Title',
            description: 'Generated Description',
            keywords: ['test'],
          }),
          originalText: 'Test transcript',
          prompt: expect.any(String),
        }),
      } as Response);

      const promise = generateNoteMetadata('Test transcript', 'sk-test-key');
      
      // Fast-forward timers to trigger retry
      vi.advanceTimersByTime(1000);
      
      const result = await promise;

      expect(result.title).toBe('Generated Title');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Retry Logic Integration', () => {
    it('should use exponential backoff for retries', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // All calls fail with retryable error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({
          error: 'Service unavailable',
          type: 'server',
          retryable: true,
        }),
      } as Response);

      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
      const promise = transcribeAudio(audioBlob, 'en', 'sk-test-key');
      
      // Track timing of retries
      const timings: number[] = [];
      let currentTime = 0;
      
      // First retry after 1 second
      vi.advanceTimersByTime(1000);
      currentTime += 1000;
      timings.push(currentTime);
      
      // Second retry after 2 seconds (exponential backoff)
      vi.advanceTimersByTime(2000);
      currentTime += 2000;
      timings.push(currentTime);
      
      // Third retry after 4 seconds (exponential backoff)
      vi.advanceTimersByTime(4000);
      currentTime += 4000;
      timings.push(currentTime);
      
      await expect(promise).rejects.toMatchObject({
        type: 'server',
      });

      expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should respect custom retry-after header', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // First call fails with custom retry-after
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: 'Rate limit exceeded',
          type: 'quota',
          retryable: true,
          retryAfter: 10, // Custom retry delay
        }),
      } as Response);

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcript: 'Success after custom delay',
          language: 'en',
        }),
      } as Response);

      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
      const promise = transcribeAudio(audioBlob, 'en', 'sk-test-key');
      
      // Fast-forward by the custom retry-after time
      vi.advanceTimersByTime(10000);
      
      const result = await promise;

      expect(result.transcript).toBe('Success after custom delay');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const mockFetch = vi.mocked(fetch);
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Bad request',
          type: 'unknown',
          retryable: false,
        }),
      } as Response);

      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
      
      await expect(transcribeAudio(audioBlob, 'en', 'sk-test-key')).rejects.toMatchObject({
        type: 'unknown',
        message: 'Bad request',
        retryable: false,
      });

      // Should not retry
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});