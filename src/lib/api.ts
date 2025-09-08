import { APIError } from '@/types';

// Configuration for retry logic
const RETRY_CONFIG = {
  // maxRetries represents the total number of attempts (initial attempt + retries)
  // Set to 2 so we try at most twice.
  maxRetries: 2,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
};

// Sleep utility for retry delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Calculate retry delay with exponential backoff
const getRetryDelay = (attempt: number): number => {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
};

// Generic retry wrapper for API calls
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = RETRY_CONFIG.maxRetries
): Promise<T> {
  // attempt is 0-based; we will perform at most `maxRetries` attempts
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry on certain error types or if this was the last allowed attempt
      const isLastAttempt = attempt === maxRetries - 1;
      if (error.type === 'auth' || !error.retryable || isLastAttempt) {
        throw error;
      }

      // Wait before retrying
      const delay = error.retryAfter ? error.retryAfter * 1000 : getRetryDelay(attempt);
      await sleep(delay);
    }
  }

  throw lastError;
}

// Parse API error response
const parseAPIError = async (response: Response): Promise<APIError> => {
  try {
    const errorData = await response.json();
    return {
      type: errorData.type || 'unknown',
      message: errorData.error || 'An unexpected error occurred',
      // If server doesn't specify retryable, default to non-retryable for 4xx and retryable for 5xx
      retryable: errorData.retryable ?? (response.status >= 500),
      retryAfter: errorData.retryAfter,
    };
  } catch {
    return {
      type: 'unknown',
      message: `HTTP ${response.status}: ${response.statusText}`,
      retryable: response.status >= 500,
    };
  }
};

// Transcribe audio using OpenAI Whisper
export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string,
  language: string = 'auto'
): Promise<{ transcript: string; language: string }> {
  return withRetry(async () => {
    try {
      const { errorLogger } = await import('./error-logging');
      
      errorLogger.info('api', 'Starting audio transcription', {
        audioSize: audioBlob.size,
        language,
        hasApiKey: !!apiKey,
      });

      const formData = new FormData();
      // Name the file according to its MIME type to avoid server-side rejection
      const mime = audioBlob.type || 'audio/webm';
      const filename = mime.includes('wav')
        ? 'recording.wav'
        : mime.includes('ogg')
          ? 'recording.ogg'
          : mime.includes('mpeg') || mime.includes('mp3')
            ? 'recording.mp3'
            : mime.includes('mp4') || mime.includes('m4a')
              ? 'recording.m4a'
              : 'recording.webm';
      formData.append('audio', audioBlob, filename);
      formData.append('language', language);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'x-openai-api-key': apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await parseAPIError(response);
        errorLogger.handleAPIError(error, '/api/transcribe');
        throw error;
      }

      const result = await response.json();
      
      // Normalize transcripts that are quote-only or whitespace-only
      const rawTranscript: string = typeof result.transcript === 'string' ? result.transcript : '';
      const trimmed = rawTranscript.trim();
      // Remove leading/trailing common quote characters and re-check emptiness
      const strippedQuotes = trimmed.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
      const normalizedTranscript = strippedQuotes.length === 0 ? '' : rawTranscript;

      errorLogger.info('api', 'Audio transcription completed', {
        transcriptLength: normalizedTranscript.length,
        detectedLanguage: result.language,
      });

      return { ...result, transcript: normalizedTranscript };
    } catch (error) {
      const { errorLogger } = await import('./error-logging');
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError: APIError = {
          type: 'network',
          message: 'Network connection failed. Please check your internet connection.',
          retryable: true,
        };
        errorLogger.handleNetworkError(error, navigator.onLine);
        throw networkError;
      }
      
      throw error;
    }
  });
}

// Rewrite text using OpenAI GPT
export async function rewriteText(
  text: string,
  prompt: string,
  apiKey: string
): Promise<{ rewrittenText: string; originalText: string; prompt: string }> {
  return withRetry(async () => {
    try {
      const { errorLogger } = await import('./error-logging');
      
      errorLogger.info('api', 'Starting text rewrite', {
        textLength: text.length,
        promptLength: prompt.length,
        hasApiKey: !!apiKey,
      });

      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-api-key': apiKey,
        },
        body: JSON.stringify({ text, prompt }),
      });

      if (!response.ok) {
        const error = await parseAPIError(response);
        errorLogger.handleAPIError(error, '/api/rewrite');
        throw error;
      }

      const result = await response.json();

      const mapped = {
        rewrittenText: result.rewrittenText ?? '',
        originalText: result.originalText ?? text,
        prompt,
      };
      
      errorLogger.info('api', 'Text rewrite completed', {
        originalLength: mapped.originalText.length,
        rewrittenLength: mapped.rewrittenText.length,
      });

      return mapped;
    } catch (error) {
      const { errorLogger } = await import('./error-logging');
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError: APIError = {
          type: 'network',
          message: 'Network connection failed. Please check your internet connection.',
          retryable: true,
        };
        errorLogger.handleNetworkError(error, navigator.onLine);
        throw networkError;
      }
      
      throw error;
    }
  });
}

// Generate title and description for a note using the rewrite API
export async function generateNoteMetadata(
  transcript: string,
  apiKey: string
): Promise<{ title: string; description: string; keywords: string[] }> {
  const metadataPrompt = `Based on the following transcript, perform these tasks:
1. Rewrite/improve the text.
2. Provide a concise title (max 50 characters).
3. Provide a brief description (max 150 characters).
4. Provide exactly 3 relevant keywords.

Return JSON with exactly these fields:
{
  "originalText": "...",        // echo of the provided transcript
  "rewrittenText": "...",       // improved text
  "title": "...",
  "description": "...",
  "keywords": ["...", "...", "..."]
}`;

  return withRetry(async () => {
    const response = await fetch('/api/rewrite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-openai-api-key': apiKey,
      },
      body: JSON.stringify({ 
        text: transcript, 
        prompt: metadataPrompt 
      }),
    });

    if (!response.ok) {
      const error = await parseAPIError(response);
      throw error;
    }

    const result = await response.json();
    // Server always returns structured output with fields: originalText, rewrittenText, description, keywords, title
    return {
      title: result.title ?? 'Untitled Note',
      description: result.description ?? 'No description available',
      keywords: result.keywords ?? [],
    };
  });
}

// Validate OpenAI API key format
export function validateAPIKey(apiKey: string): boolean {
  // OpenAI API keys start with 'sk-' and are typically 51 characters long
  return /^sk-[a-zA-Z0-9]{48}$/.test(apiKey);
}

// Get user-friendly error message for display
export function getErrorMessage(error: APIError): string {
  switch (error.type) {
    case 'auth':
      return 'Invalid API key. Please check your OpenAI API key in settings.';
    case 'quota':
      const retryMessage = error.retryAfter 
        ? ` Please try again in ${error.retryAfter} seconds.`
        : ' Please try again later.';
      return `Rate limit exceeded.${retryMessage}`;
    case 'network':
      return 'Network error. Please check your internet connection and try again.';
    case 'server':
      return 'OpenAI service is temporarily unavailable. Please try again in a few minutes.';
    default:
      return error.message || 'An unexpected error occurred. Please try again.';
  }
}

// Check if an error is retryable
export function isRetryableError(error: APIError): boolean {
  return error.retryable && error.type !== 'auth';
}