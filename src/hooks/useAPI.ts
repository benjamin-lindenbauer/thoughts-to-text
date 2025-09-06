import { useState, useCallback } from 'react';
import { APIError } from '@/types';
import { 
  transcribeAudio, 
  rewriteText, 
  generateNoteMetadata, 
  getErrorMessage,
  isRetryableError 
} from '@/lib/api';

interface APIState {
  isLoading: boolean;
  error: APIError | null;
  lastOperation: string | null;
}

interface UseAPIReturn {
  state: APIState;
  transcribe: (audioBlob: Blob, language: string, apiKey: string) => Promise<{ transcript: string; language: string } | null>;
  rewrite: (text: string, prompt: string, apiKey: string) => Promise<{ rewrittenText: string; originalText: string; prompt: string } | null>;
  generateMetadata: (transcript: string, apiKey: string) => Promise<{ title: string; description: string; keywords: string[] } | null>;
  clearError: () => void;
  retry: () => Promise<void>;
}

export function useAPI(): UseAPIReturn {
  const [state, setState] = useState<APIState>({
    isLoading: false,
    error: null,
    lastOperation: null,
  });

  const [lastOperationParams, setLastOperationParams] = useState<{
    operation: 'transcribe';
    params: [Blob, string, string];
  } | {
    operation: 'rewrite';
    params: [string, string, string];
  } | {
    operation: 'generateMetadata';
    params: [string, string];
  } | null>(null);

  const setLoading = useCallback((loading: boolean, operation?: string) => {
    setState(prev => ({
      ...prev,
      isLoading: loading,
      lastOperation: operation || prev.lastOperation,
      error: loading ? null : prev.error,
    }));
  }, []);

  const setError = useCallback((error: APIError) => {
    setState(prev => ({
      ...prev,
      isLoading: false,
      error,
    }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  const transcribe = useCallback(async (
    audioBlob: Blob, 
    language: string, 
    apiKey: string
  ): Promise<{ transcript: string; language: string } | null> => {
    try {
      setLoading(true, 'transcribe');
      setLastOperationParams({
        operation: 'transcribe',
        params: [audioBlob, language, apiKey],
      });

      const result = await transcribeAudio(audioBlob, language, apiKey);
      setLoading(false);
      return result;
    } catch (error) {
      const apiError = error as APIError;
      setError(apiError);
      return null;
    }
  }, [setLoading, setError]);

  const rewrite = useCallback(async (
    text: string, 
    prompt: string, 
    apiKey: string
  ): Promise<{ rewrittenText: string; originalText: string; prompt: string } | null> => {
    try {
      setLoading(true, 'rewrite');
      setLastOperationParams({
        operation: 'rewrite',
        params: [text, prompt, apiKey],
      });

      const result = await rewriteText(text, prompt, apiKey);
      setLoading(false);
      return result;
    } catch (error) {
      const apiError = error as APIError;
      setError(apiError);
      return null;
    }
  }, [setLoading, setError]);

  const generateMetadata = useCallback(async (
    transcript: string, 
    apiKey: string
  ): Promise<{ title: string; description: string; keywords: string[] } | null> => {
    try {
      setLoading(true, 'generateMetadata');
      setLastOperationParams({
        operation: 'generateMetadata',
        params: [transcript, apiKey],
      });

      const result = await generateNoteMetadata(transcript, apiKey);
      setLoading(false);
      return result;
    } catch (error) {
      const apiError = error as APIError;
      setError(apiError);
      return null;
    }
  }, [setLoading, setError]);

  const retry = useCallback(async (): Promise<void> => {
    if (!lastOperationParams || !state.error || !isRetryableError(state.error)) {
      return;
    }

    const { operation, params } = lastOperationParams;

    try {
      switch (operation) {
        case 'transcribe':
          await transcribe(params[0], params[1], params[2]);
          break;
        case 'rewrite':
          await rewrite(params[0], params[1], params[2]);
          break;
        case 'generateMetadata':
          await generateMetadata(params[0], params[1]);
          break;
      }
    } catch (error) {
      // Error is already handled by the individual methods
    }
  }, [lastOperationParams, state.error, transcribe, rewrite, generateMetadata]);

  return {
    state,
    transcribe,
    rewrite,
    generateMetadata,
    clearError,
    retry,
  };
}

// Hook for getting user-friendly error messages
export function useAPIErrorMessage(error: APIError | null): string | null {
  if (!error) return null;
  return getErrorMessage(error);
}