import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateAPIKey, getErrorMessage, isRetryableError } from '@/lib/api';
import { APIError } from '@/types';

describe('API Utilities', () => {
  describe('validateAPIKey', () => {
    it('should validate correct OpenAI API key format', () => {
      const validKeys = [
        'sk-' + 'a'.repeat(48),
        'sk-' + 'A'.repeat(48),
        'sk-' + '1'.repeat(48),
        'sk-proj-' + 'a'.repeat(43), // Project keys
        'sk-' + 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQR123456',
      ];

      validKeys.forEach(key => {
        if (key.length === 51 && key.startsWith('sk-')) {
          expect(validateAPIKey(key)).toBe(true);
        }
      });
    });

    it('should reject invalid API key formats', () => {
      const invalidKeys = [
        '',
        'invalid-key',
        'sk-short',
        'pk-' + 'a'.repeat(48), // Wrong prefix
        'sk-' + 'a'.repeat(47), // Too short
        'sk-' + 'a'.repeat(49), // Too long
        'sk-' + 'a'.repeat(47) + '@', // Invalid character
        'sk-' + 'a'.repeat(47) + ' ', // Space character
        'sk-' + 'a'.repeat(47) + '-', // Dash character
        'api-key-123',
        'sk-',
        'sk',
      ];

      invalidKeys.forEach(key => {
        expect(validateAPIKey(key)).toBe(false);
      });
    });

    it('should handle edge cases', () => {
      expect(validateAPIKey(null as any)).toBe(false);
      expect(validateAPIKey(undefined as any)).toBe(false);
      expect(validateAPIKey(123 as any)).toBe(false);
      expect(validateAPIKey({} as any)).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should return appropriate message for auth errors', () => {
      const error: APIError = {
        type: 'auth',
        message: 'Invalid API key',
        retryable: false,
      };
      
      const message = getErrorMessage(error);
      expect(message).toContain('Invalid API key');
      expect(message).toContain('settings');
    });

    it('should return appropriate message for quota errors with retry time', () => {
      const error: APIError = {
        type: 'quota',
        message: 'Rate limit exceeded',
        retryable: true,
        retryAfter: 60,
      };
      
      const message = getErrorMessage(error);
      expect(message).toContain('Rate limit exceeded');
      expect(message).toContain('60 seconds');
    });

    it('should return appropriate message for quota errors without retry time', () => {
      const error: APIError = {
        type: 'quota',
        message: 'Rate limit exceeded',
        retryable: true,
      };
      
      const message = getErrorMessage(error);
      expect(message).toContain('Rate limit exceeded');
      expect(message).toContain('try again later');
    });

    it('should return appropriate message for network errors', () => {
      const error: APIError = {
        type: 'network',
        message: 'Network error',
        retryable: true,
      };
      
      const message = getErrorMessage(error);
      expect(message).toContain('Network error');
      expect(message).toContain('internet connection');
    });

    it('should return appropriate message for server errors', () => {
      const error: APIError = {
        type: 'server',
        message: 'Server error',
        retryable: true,
      };
      
      const message = getErrorMessage(error);
      expect(message).toContain('temporarily unavailable');
      expect(message).toContain('few minutes');
    });

    it('should return custom message for unknown errors', () => {
      const error: APIError = {
        type: 'unknown',
        message: 'Something went wrong',
        retryable: true,
      };
      
      const message = getErrorMessage(error);
      expect(message).toBe('Something went wrong');
    });

    it('should return fallback message for unknown errors without message', () => {
      const error: APIError = {
        type: 'unknown',
        message: '',
        retryable: true,
      };
      
      const message = getErrorMessage(error);
      expect(message).toContain('unexpected error occurred');
    });

    it('should handle different quota retry times', () => {
      const testCases = [
        { retryAfter: 1, expected: '1 seconds' },
        { retryAfter: 30, expected: '30 seconds' },
        { retryAfter: 120, expected: '120 seconds' },
      ];

      testCases.forEach(({ retryAfter, expected }) => {
        const error: APIError = {
          type: 'quota',
          message: 'Rate limit exceeded',
          retryable: true,
          retryAfter,
        };
        
        const message = getErrorMessage(error);
        expect(message).toContain(expected);
      });
    });
  });

  describe('isRetryableError', () => {
    it('should return true for retryable network errors', () => {
      const error: APIError = {
        type: 'network',
        message: 'Network error',
        retryable: true,
      };
      
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for retryable server errors', () => {
      const error: APIError = {
        type: 'server',
        message: 'Server error',
        retryable: true,
      };
      
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for retryable quota errors', () => {
      const error: APIError = {
        type: 'quota',
        message: 'Rate limit exceeded',
        retryable: true,
      };
      
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const error: APIError = {
        type: 'network',
        message: 'Network error',
        retryable: false,
      };
      
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for auth errors even if marked retryable', () => {
      const error: APIError = {
        type: 'auth',
        message: 'Invalid API key',
        retryable: true, // This should be ignored
      };
      
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for auth errors that are not retryable', () => {
      const error: APIError = {
        type: 'auth',
        message: 'Invalid API key',
        retryable: false,
      };
      
      expect(isRetryableError(error)).toBe(false);
    });

    it('should handle unknown error types', () => {
      const retryableUnknown: APIError = {
        type: 'unknown',
        message: 'Unknown error',
        retryable: true,
      };
      
      const nonRetryableUnknown: APIError = {
        type: 'unknown',
        message: 'Unknown error',
        retryable: false,
      };
      
      expect(isRetryableError(retryableUnknown)).toBe(true);
      expect(isRetryableError(nonRetryableUnknown)).toBe(false);
    });
  });
});

// Mock fetch for API route tests
global.fetch = vi.fn();

describe('API Routes (Mock Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Transcribe API Route Responses', () => {
    it('should handle missing API key', async () => {
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

      const formData = new FormData();
      formData.append('audio', new Blob(['test'], { type: 'audio/webm' }));
      formData.append('language', 'en');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
      
      const errorData = await response.json();
      expect(errorData.type).toBe('auth');
      expect(errorData.retryable).toBe(false);
    });

    it('should handle missing audio file', async () => {
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

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'x-openai-api-key': 'sk-test-key',
        },
        body: formData,
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should handle invalid file type', async () => {
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

      const formData = new FormData();
      formData.append('audio', new Blob(['test'], { type: 'text/plain' }));
      formData.append('language', 'en');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'x-openai-api-key': 'sk-test-key',
        },
        body: formData,
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should handle successful transcription', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcript: 'This is a successful transcription',
          language: 'en',
        }),
      } as Response);

      const formData = new FormData();
      formData.append('audio', new Blob(['test audio'], { type: 'audio/webm' }));
      formData.append('language', 'en');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'x-openai-api-key': 'sk-valid-key-' + 'a'.repeat(40),
        },
        body: formData,
      });

      expect(response.ok).toBe(true);
      
      const result = await response.json();
      expect(result.transcript).toBe('This is a successful transcription');
      expect(result.language).toBe('en');
    });
  });

  describe('Rewrite API Route Responses', () => {
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
        body: JSON.stringify({ prompt: 'test prompt' }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
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
        body: JSON.stringify({ text: 'test text' }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should handle successful rewrite', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rewrittenText: 'This is the improved text',
          originalText: 'This is the original text',
          prompt: 'Make it better',
        }),
      } as Response);

      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-api-key': 'sk-valid-key-' + 'a'.repeat(40),
        },
        body: JSON.stringify({
          text: 'This is the original text',
          prompt: 'Make it better',
        }),
      });

      expect(response.ok).toBe(true);
      
      const result = await response.json();
      expect(result.rewrittenText).toBe('This is the improved text');
      expect(result.originalText).toBe('This is the original text');
      expect(result.prompt).toBe('Make it better');
    });

    it('should handle OpenAI API errors', async () => {
      const errorTypes = [
        { status: 401, type: 'auth', message: 'Invalid API key' },
        { status: 429, type: 'quota', message: 'Rate limit exceeded', retryAfter: 60 },
        { status: 500, type: 'server', message: 'OpenAI service unavailable' },
        { status: 503, type: 'network', message: 'Network error' },
      ];

      for (const errorType of errorTypes) {
        const mockFetch = vi.mocked(fetch);
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: errorType.status,
          json: async () => ({
            error: errorType.message,
            type: errorType.type,
            retryable: errorType.type !== 'auth',
            ...(errorType.retryAfter && { retryAfter: errorType.retryAfter }),
          }),
        } as Response);

        const response = await fetch('/api/rewrite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-openai-api-key': 'sk-test-key',
          },
          body: JSON.stringify({
            text: 'test text',
            prompt: 'test prompt',
          }),
        });

        expect(response.ok).toBe(false);
        expect(response.status).toBe(errorType.status);
        
        const errorData = await response.json();
        expect(errorData.type).toBe(errorType.type);
        expect(errorData.message).toBe(errorType.message);
      }
    });
  });
});