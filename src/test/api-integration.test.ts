import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transcribeAudio, rewriteText, generateNoteMetadata } from '@/lib/api';

// Mock fetch globally
global.fetch = vi.fn();

describe('API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('transcribeAudio', () => {
    it('should successfully transcribe audio', async () => {
      const mockResponse = {
        transcript: 'Hello world',
        language: 'en',
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
      const result = await transcribeAudio(audioBlob, 'en', 'sk-test-key');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/transcribe', {
        method: 'POST',
        headers: {
          'x-openai-api-key': 'sk-test-key',
        },
        body: expect.any(FormData),
      });
    });

    it('should handle API errors with retry', async () => {
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

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcript: 'Hello world',
          language: 'en',
        }),
      } as Response);

      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
      const result = await transcribeAudio(audioBlob, 'en', 'sk-test-key');

      expect(result.transcript).toBe('Hello world');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('rewriteText', () => {
    it('should successfully rewrite text', async () => {
      const mockResponse = {
        rewrittenText: 'Improved text',
        originalText: 'Original text',
        prompt: 'Make it better',
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await rewriteText('Original text', 'Make it better', 'sk-test-key');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-api-key': 'sk-test-key',
        },
        body: JSON.stringify({
          text: 'Original text',
          prompt: 'Make it better',
        }),
      });
    });
  });

  describe('generateNoteMetadata', () => {
    it('should generate metadata from transcript', async () => {
      const mockResponse = {
        rewrittenText: JSON.stringify({
          title: 'Meeting Notes',
          description: 'Discussion about project',
          keywords: ['meeting', 'project', 'discussion'],
        }),
        originalText: 'We discussed the project',
        prompt: expect.any(String),
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await generateNoteMetadata('We discussed the project', 'sk-test-key');

      expect(result).toEqual({
        title: 'Meeting Notes',
        description: 'Discussion about project',
        keywords: ['meeting', 'project', 'discussion'],
      });
    });

    it('should fallback to simple metadata if JSON parsing fails', async () => {
      const mockResponse = {
        rewrittenText: 'Invalid JSON response',
        originalText: 'We discussed the project',
        prompt: expect.any(String),
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await generateNoteMetadata('We discussed the project', 'sk-test-key');

      expect(result.title).toBe('We discussed the project');
      expect(result.description).toBe('We discussed the project');
      expect(result.keywords).toEqual([]);
    });
  });
});