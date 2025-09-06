import { APIError } from '@/types';

// Configuration for retry logic
const RETRY_CONFIG = {
  maxRetries: 3,
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
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry on certain error types
      if (error.type === 'auth' || !error.retryable || attempt === maxRetries) {
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
      retryable: errorData.retryable !== false,
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
  language: string,
  apiKey: string
): Promise<{ transcript: string; language: string }> {
  return withRetry(async () => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
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
      throw error;
    }

    return response.json();
  });
}

// Rewrite text using OpenAI GPT
export async function rewriteText(
  text: string,
  prompt: string,
  apiKey: string
): Promise<{ rewrittenText: string; originalText: string; prompt: string }> {
  return withRetry(async () => {
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
      throw error;
    }

    return response.json();
  });
}

// Generate title and description for a note using the rewrite API
export async function generateNoteMetadata(
  transcript: string,
  apiKey: string
): Promise<{ title: string; description: string; keywords: string[] }> {
  const metadataPrompt = `Based on the following transcript, generate:
1. A concise title (max 50 characters)
2. A brief description (max 150 characters)
3. 3-5 relevant keywords

Format your response as JSON:
{
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
    
    try {
      // Try to parse the rewritten text as JSON
      const metadata = JSON.parse(result.rewrittenText);
      return {
        title: metadata.title || 'Untitled Note',
        description: metadata.description || 'No description available',
        keywords: Array.isArray(metadata.keywords) ? metadata.keywords : [],
      };
    } catch {
      // Fallback if JSON parsing fails
      return {
        title: transcript.slice(0, 50) + (transcript.length > 50 ? '...' : ''),
        description: transcript.slice(0, 150) + (transcript.length > 150 ? '...' : ''),
        keywords: [],
      };
    }
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