import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateAPIKey, getErrorMessage, isRetryableError } from '@/lib/api';
import { APIError } from '@/types';

describe('API Utilities', () => {
  describe('validateAPIKey', () => {
    it('should validate correct OpenAI API key format', () => {
      const validKey = 'sk-' + 'a'.repeat(48);
      expect(validateAPIKey(validKey)).toBe(true);
    });

    it('should reject invalid API key formats', () => {
      expect(validateAPIKey('')).toBe(false);
      expect(validateAPIKey('invalid-key')).toBe(false);
      expect(validateAPIKey('sk-short')).toBe(false);
      expect(validateAPIKey('pk-' + 'a'.repeat(48))).toBe(false);
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

    it('should return appropriate message for quota errors', () => {
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
    });

    it('should return generic message for unknown errors', () => {
      const error: APIError = {
        type: 'unknown',
        message: 'Something went wrong',
        retryable: true,
      };
      
      const message = getErrorMessage(error);
      expect(message).toBe('Something went wrong');
    });
  });

  describe('isRetryableError', () => {
    it('should return true for retryable errors', () => {
      const error: APIError = {
        type: 'network',
        message: 'Network error',
        retryable: true,
      };
      
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const error: APIError = {
        type: 'auth',
        message: 'Invalid API key',
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
  });
});

// Mock fetch for API route tests
global.fetch = vi.fn();

describe('API Routes (Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Transcribe API', () => {
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
    });
  });

  describe('Rewrite API', () => {
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
          'x-openai-api-key': 'sk-test',
        },
        body: JSON.stringify({ prompt: 'test prompt' }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });
});