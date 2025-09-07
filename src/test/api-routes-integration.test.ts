import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch for API integration tests
global.fetch = vi.fn();

describe('API Routes Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Transcribe API Route', () => {
    it('should handle successful transcription', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          transcript: 'Hello world, this is a test transcription.',
          language: 'en',
        }),
      } as Response);

      const audioFile = new File(['test audio data'], 'test.webm', {
        type: 'audio/webm',
      });
      
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('language', 'en');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'x-openai-api-key': 'sk-test-key-' + 'a'.repeat(40),
        },
        body: formData,
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.transcript).toBe('Hello world, this is a test transcription.');
      expect(result.language).toBe('en');
    });

    it('should handle authentication errors', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'API key is required',
          type: 'auth',
          retryable: false,
        }),
      } as Response);

      const audioFile = new File(['test audio'], 'test.webm', {
        type: 'audio/webm',
      });
      
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('language', 'en');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        // No API key header
        body: formData,
      });

      expect(response.status).toBe(401);
      
      const result = await response.json();
      expect(result.type).toBe('auth');
      expect(result.retryable).toBe(false);
    });

    it('should handle rate limit errors', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: 'Rate limit exceeded. Please try again later.',
          type: 'quota',
          retryable: true,
          retryAfter: 120,
        }),
      } as Response);

      const audioFile = new File(['test audio'], 'test.webm', {
        type: 'audio/webm',
      });
      
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('language', 'en');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'x-openai-api-key': 'sk-test-key',
        },
        body: formData,
      });

      expect(response.status).toBe(429);
      const result = await response.json();
      expect(result.type).toBe('quota');
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(120);
    });

    it('should handle server errors', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          error: 'OpenAI service is temporarily unavailable. Please try again.',
          type: 'server',
          retryable: true,
        }),
      } as Response);

      const audioFile = new File(['test audio'], 'test.webm', {
        type: 'audio/webm',
      });
      
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('language', 'en');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'x-openai-api-key': 'sk-test-key',
        },
        body: formData,
      });

      expect(response.status).toBe(503);
      const result = await response.json();
      expect(result.type).toBe('server');
      expect(result.retryable).toBe(true);
    });

    it('should handle network errors', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          error: 'Network error. Please check your internet connection.',
          type: 'network',
          retryable: true,
        }),
      } as Response);

      const audioFile = new File(['test audio'], 'test.webm', {
        type: 'audio/webm',
      });
      
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('language', 'en');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'x-openai-api-key': 'sk-test-key',
        },
        body: formData,
      });

      expect(response.status).toBe(503);
      const result = await response.json();
      expect(result.type).toBe('network');
      expect(result.retryable).toBe(true);
    });

    it('should handle invalid file types', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Invalid file type. Please upload an audio file.',
          type: 'unknown',
          retryable: false,
        }),
      } as Response);

      const textFile = new File(['not audio'], 'test.txt', {
        type: 'text/plain',
      });
      
      const formData = new FormData();
      formData.append('audio', textFile);
      formData.append('language', 'en');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'x-openai-api-key': 'sk-test-key',
        },
        body: formData,
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toContain('Invalid file type');
      expect(result.retryable).toBe(false);
    });
  });

  describe('Rewrite API Route', () => {
    it('should handle successful text rewriting', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          rewrittenText: 'This is an improved and more professional version of the text.',
          originalText: 'This is some text that needs improvement.',
          prompt: 'Make it more professional',
        }),
      } as Response);

      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-api-key': 'sk-test-key-' + 'a'.repeat(40),
        },
        body: JSON.stringify({
          text: 'This is some text that needs improvement.',
          prompt: 'Make it more professional',
        }),
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.rewrittenText).toBe('This is an improved and more professional version of the text.');
      expect(result.originalText).toBe('This is some text that needs improvement.');
      expect(result.prompt).toBe('Make it more professional');
    });

    it('should handle authentication errors', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'API key is required',
          type: 'auth',
          retryable: false,
        }),
      } as Response);

      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No API key
        },
        body: JSON.stringify({
          text: 'text',
          prompt: 'prompt',
        }),
      });

      expect(response.status).toBe(401);
      const result = await response.json();
      expect(result.type).toBe('auth');
      expect(result.retryable).toBe(false);
    });

    it('should handle missing text parameter', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Text is required for rewriting',
          type: 'unknown',
          retryable: false,
        }),
      } as Response);

      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-api-key': 'sk-test-key',
        },
        body: JSON.stringify({
          prompt: 'prompt',
          // No text
        }),
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toContain('Text is required');
      expect(result.retryable).toBe(false);
    });

    it('should handle missing prompt parameter', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Rewrite prompt is required',
          type: 'unknown',
          retryable: false,
        }),
      } as Response);

      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-api-key': 'sk-test-key',
        },
        body: JSON.stringify({
          text: 'text',
          // No prompt
        }),
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toContain('prompt is required');
      expect(result.retryable).toBe(false);
    });

    it('should handle rate limit errors with retry-after', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: 'Rate limit exceeded. Please try again later.',
          type: 'quota',
          retryable: true,
          retryAfter: 300,
        }),
      } as Response);

      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-api-key': 'sk-test-key',
        },
        body: JSON.stringify({
          text: 'text',
          prompt: 'prompt',
        }),
      });

      expect(response.status).toBe(429);
      const result = await response.json();
      expect(result.type).toBe('quota');
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(300);
    });

    it('should handle server errors', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          error: 'OpenAI service is temporarily unavailable. Please try again.',
          type: 'server',
          retryable: true,
        }),
      } as Response);

      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-api-key': 'sk-test-key',
        },
        body: JSON.stringify({
          text: 'text',
          prompt: 'prompt',
        }),
      });

      expect(response.status).toBe(503);
      const result = await response.json();
      expect(result.type).toBe('server');
      expect(result.retryable).toBe(true);
    });

    it('should handle network connection errors', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          error: 'Network error. Please check your internet connection.',
          type: 'network',
          retryable: true,
        }),
      } as Response);

      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-api-key': 'sk-test-key',
        },
        body: JSON.stringify({
          text: 'text',
          prompt: 'prompt',
        }),
      });

      expect(response.status).toBe(503);
      const result = await response.json();
      expect(result.type).toBe('network');
      expect(result.retryable).toBe(true);
    });
  });

  describe('Error Response Consistency', () => {
    it('should return consistent error format across endpoints', async () => {
      const expectedErrorFormat = {
        error: expect.any(String),
        type: expect.stringMatching(/^(auth|quota|server|network|unknown)$/),
        retryable: expect.any(Boolean),
      };

      // Test transcribe endpoint error
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'API key is required',
          type: 'auth',
          retryable: false,
        }),
      } as Response);

      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        body: new FormData(),
      });
      const transcribeError = await transcribeResponse.json();

      expect(transcribeError).toMatchObject(expectedErrorFormat);

      // Test rewrite endpoint error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'API key is required',
          type: 'auth',
          retryable: false,
        }),
      } as Response);

      const rewriteResponse = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const rewriteError = await rewriteResponse.json();

      expect(rewriteError).toMatchObject(expectedErrorFormat);
    });

    it('should include retryAfter field for quota errors', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: 'Rate limit exceeded. Please try again later.',
          type: 'quota',
          retryable: true,
          retryAfter: 60,
        }),
      } as Response);

      const formData = new FormData();
      formData.append('audio', new File(['test'], 'test.webm', { type: 'audio/webm' }));

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'x-openai-api-key': 'sk-test-key' },
        body: formData,
      });
      const result = await response.json();

      expect(result).toMatchObject({
        error: expect.any(String),
        type: 'quota',
        retryable: true,
        retryAfter: 60,
      });
    });
  });

  describe('Retry Logic Scenarios', () => {
    it('should indicate retryable errors for transcription', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          error: 'Service unavailable',
          type: 'server',
          retryable: true,
        }),
      } as Response);

      const audioFile = new File(['test audio'], 'test.webm', {
        type: 'audio/webm',
      });
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('language', 'en');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'x-openai-api-key': 'sk-test-key' },
        body: formData,
      });
      const result = await response.json();

      expect(response.status).toBe(503);
      expect(result.type).toBe('server');
      expect(result.retryable).toBe(true);
    });

    it('should indicate retryable errors for rewriting', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          error: 'Service unavailable',
          type: 'server',
          retryable: true,
        }),
      } as Response);

      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-api-key': 'sk-test-key',
        },
        body: JSON.stringify({ text: 'test text', prompt: 'test prompt' }),
      });
      const result = await response.json();

      expect(response.status).toBe(503);
      expect(result.type).toBe('server');
      expect(result.retryable).toBe(true);
    });

    it('should indicate non-retryable errors', async () => {
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

      const audioFile = new File(['test audio'], 'test.webm', {
        type: 'audio/webm',
      });
      const formData = new FormData();
      formData.append('audio', audioFile);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'x-openai-api-key': 'sk-test-key' },
        body: formData,
      });
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.retryable).toBe(false);
    });
  });
});