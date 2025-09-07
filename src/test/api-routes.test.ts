import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch for API integration tests
global.fetch = vi.fn();

describe('API Routes Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('/api/transcribe endpoint', () => {
    it('should successfully transcribe audio with valid inputs', async () => {
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
      expect(result).toEqual({
        transcript: 'Hello world, this is a test transcription.',
        language: 'en',
      });
    });

    it('should handle different languages correctly', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          transcript: 'Bonjour le monde',
          language: 'fr',
        }),
      } as Response);

      const audioFile = new File(['test audio'], 'test.webm', {
        type: 'audio/webm',
      });
      
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('language', 'fr');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'x-openai-api-key': 'sk-test-key-' + 'a'.repeat(40),
        },
        body: formData,
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.language).toBe('fr');
      expect(result.transcript).toBe('Bonjour le monde');
    });

    it('should return 401 when API key is missing', async () => {
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
      expect(result).toEqual({
        error: 'API key is required',
        type: 'auth',
        retryable: false,
      });
    });

    it('should return 400 when audio file is missing', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Audio file is required',
          type: 'unknown',
          retryable: false,
        }),
      } as Response);

      const formData = new FormData();
      formData.append('language', 'en');
      // No audio file

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'x-openai-api-key': 'sk-test-key',
        },
        body: formData,
      });
      
      expect(response.status).toBe(400);
      
      const result = await response.json();
      expect(result).toEqual({
        error: 'Audio file is required',
        type: 'unknown',
        retryable: false,
      });
    });

    it('should return 400 for invalid file type', async () => {
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
    });

    it('should handle OpenAI authentication errors (401)', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'Invalid API key. Please check your OpenAI API key.',
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
        headers: {
          'x-openai-api-key': 'invalid-key',
        },
        body: formData,
      });

      expect(response.status).toBe(401);
      const result = await response.json();
      expect(result.type).toBe('auth');
      expect(result.retryable).toBe(false);
    });

    it('should handle OpenAI rate limit errors (429)', async () => {
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

    it('should handle OpenAI server errors (500+)', async () => {
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
  });

  describe('/api/rewrite endpoint', () => {
    it('should successfully rewrite text with valid inputs', async () => {
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
      expect(result).toEqual({
        rewrittenText: 'This is an improved and more professional version of the text.',
        originalText: 'This is some text that needs improvement.',
        prompt: 'Make it more professional',
      });
    });

    it('should handle different rewrite prompts', async () => {
      const prompts = [
        'Make it more casual',
        'Summarize this text',
        'Fix grammar and spelling',
        'Translate to French',
      ];

      for (const prompt of prompts) {
        const mockFetch = vi.mocked(fetch);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            rewrittenText: `Rewritten with: ${prompt}`,
            originalText: 'Original text',
            prompt: prompt,
          }),
        } as Response);

        const response = await fetch('/api/rewrite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-openai-api-key': 'sk-test-key',
          },
          body: JSON.stringify({
            text: 'Original text',
            prompt: prompt,
          }),
        });
        const result = await response.json();
        
        expect(result.prompt).toBe(prompt);
        expect(result.rewrittenText).toContain(prompt);
      }
    });

    it('should return 401 when API key is missing', async () => {
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

    it('should return 400 when text is missing', async () => {
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
    });

    it('should return 400 when prompt is missing', async () => {
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
    });

    it('should handle empty rewritten text response', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'No rewritten text was generated',
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

      expect(response.status).toBe(500);
      const result = await response.json();
      expect(result.error).toContain('No rewritten text');
      expect(result.type).toBe('server');
    });

    it('should handle OpenAI authentication errors (401)', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'Invalid API key. Please check your OpenAI API key.',
          type: 'auth',
          retryable: false,
        }),
      } as Response);

      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-api-key': 'invalid-key',
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

    it('should handle OpenAI rate limit errors with custom retry-after', async () => {
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
      expect(result.retryAfter).toBe(300);
    });

    it('should handle OpenAI server errors', async () => {
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
    it('should return consistent error format across all endpoints', async () => {
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
        body: new FormData(), // Missing API key and audio
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
        body: JSON.stringify({}), // Missing API key, text, and prompt
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

    it('should handle missing retry-after header gracefully', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: 'Rate limit exceeded. Please try again later.',
          type: 'quota',
          retryable: true,
          retryAfter: 60, // Default fallback
        }),
      } as Response);

      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-api-key': 'sk-test-key',
        },
        body: JSON.stringify({ text: 'test', prompt: 'test' }),
      });
      const result = await response.json();

      expect(result).toMatchObject({
        error: expect.any(String),
        type: 'quota',
        retryable: true,
        retryAfter: 60, // Default fallback
      });
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle very large audio files', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          transcript: 'Large file transcription',
          language: 'en',
        }),
      } as Response);

      // Create a large audio file (simulate smaller size for test performance)
      const largeAudioData = new Array(1024).fill(0);
      const largeAudioFile = new File([new Uint8Array(largeAudioData)], 'large.webm', {
        type: 'audio/webm',
      });

      const formData = new FormData();
      formData.append('audio', largeAudioFile);
      formData.append('language', 'en');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'x-openai-api-key': 'sk-test-key' },
        body: formData,
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.transcript).toBe('Large file transcription');
    });

    it('should handle very long text for rewriting', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          rewrittenText: 'Rewritten long text',
          originalText: 'A'.repeat(1000),
          prompt: 'B'.repeat(100),
        }),
      } as Response);

      const longText = 'A'.repeat(1000); // 1k characters for test performance
      const longPrompt = 'B'.repeat(100); // 100 characters

      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-api-key': 'sk-test-key',
        },
        body: JSON.stringify({ text: longText, prompt: longPrompt }),
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.rewrittenText).toBe('Rewritten long text');
      expect(result.originalText).toBe(longText);
    });

    it('should handle special characters in text and prompts', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          rewrittenText: 'Processed special characters correctly',
          originalText: 'Text with émojis 🎵 and spëcial chars: @#$%^&*()',
          prompt: 'Prompt with ñ, ü, and other spëcial chars',
        }),
      } as Response);

      const specialText = 'Text with émojis 🎵 and spëcial chars: @#$%^&*()';
      const specialPrompt = 'Prompt with ñ, ü, and other spëcial chars';

      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-api-key': 'sk-test-key',
        },
        body: JSON.stringify({ text: specialText, prompt: specialPrompt }),
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.originalText).toBe(specialText);
      expect(result.prompt).toBe(specialPrompt);
    });

    it('should handle empty strings gracefully', async () => {
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
        body: JSON.stringify({ text: '', prompt: '' }),
      });
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toContain('required');
    });
  });

  describe('Retry Logic Integration', () => {
    it('should handle retry scenarios for transcription', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // First call fails with retryable error
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

    it('should handle retry scenarios for rewriting', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // First call fails with retryable error
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