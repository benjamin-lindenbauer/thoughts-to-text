import { useState, useCallback, useEffect } from 'react';
import { APIError } from '@/types';
import { 
  transcribeAudio, 
  rewriteText, 
  generateNoteMetadata, 
  getErrorMessage,
  isRetryableError 
} from '@/lib/api';
import { useOffline } from '@/hooks/useOffline';
import { pwaManager } from '@/lib/pwa';

interface APIState {
  isLoading: boolean;
  error: APIError | null;
  lastOperation: string | null;
  isQueued: boolean;
}

interface UseAPIWithOfflineReturn {
  state: APIState;
  transcribe: (audioBlob: Blob, language: string, apiKey: string) => Promise<{ transcript: string; language: string } | null>;
  rewrite: (text: string, prompt: string, apiKey: string) => Promise<{ rewrittenText: string; originalText: string; prompt: string } | null>;
  generateMetadata: (transcript: string, apiKey: string) => Promise<{ title: string; description: string; keywords: string[] } | null>;
  clearError: () => void;
  retry: () => Promise<void>;
}

export function useAPIWithOffline(): UseAPIWithOfflineReturn {
  const [state, setState] = useState<APIState>({
    isLoading: false,
    error: null,
    lastOperation: null,
    isQueued: false,
  });

  const { isOnline, addToSyncQueue } = useOffline();

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
      isQueued: false,
    }));
  }, []);

  const setError = useCallback((error: APIError) => {
    setState(prev => ({
      ...prev,
      isLoading: false,
      error,
      isQueued: false,
    }));
  }, []);

  const setQueued = useCallback((queued: boolean) => {
    setState(prev => ({
      ...prev,
      isLoading: false,
      error: null,
      isQueued: queued,
    }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  // Listen for sync processing events
  useEffect(() => {
    const handleSyncProcess = (event: CustomEvent) => {
      const { item } = event.detail;
      
      // Process the queued item
      processQueuedItem(item);
    };

    window.addEventListener('pwa-sync-process', handleSyncProcess as EventListener);
    
    return () => {
      window.removeEventListener('pwa-sync-process', handleSyncProcess as EventListener);
    };
  }, []);

  const processQueuedItem = async (item: any) => {
    try {
      switch (item.type) {
        case 'transcription':
          await processQueuedTranscription(item.data);
          break;
        case 'rewrite':
          await processQueuedRewrite(item.data);
          break;
      }
    } catch (error) {
      console.error('Failed to process queued item:', error);
      throw error;
    }
  };

  const processQueuedTranscription = async (data: any) => {
    const { audioBlob, language, apiKey, noteId } = data;
    const result = await transcribeAudio(audioBlob, language, apiKey);
    
    // Dispatch event with result for the app to handle
    window.dispatchEvent(new CustomEvent('transcription-complete', {
      detail: { noteId, result }
    }));
  };

  const processQueuedRewrite = async (data: any) => {
    const { text, prompt, apiKey, noteId } = data;
    const result = await rewriteText(text, prompt, apiKey);
    
    // Dispatch event with result for the app to handle
    window.dispatchEvent(new CustomEvent('rewrite-complete', {
      detail: { noteId, result }
    }));
  };

  const transcribe = useCallback(async (
    audioBlob: Blob, 
    language: string, 
    apiKey: string,
    noteId?: string
  ): Promise<{ transcript: string; language: string } | null> => {
    if (!isOnline) {
      // Queue for offline processing
      const queueId = addToSyncQueue('transcription', {
        audioBlob,
        language,
        apiKey,
        noteId,
        timestamp: Date.now(),
      });
      
      setQueued(true);
      
      // Return a placeholder result
      return {
        transcript: '[Transcription queued for when you\'re back online]',
        language,
      };
    }

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
      
      // If it's a network error and we're offline, queue it
      if (apiError.type === 'network' && !isOnline) {
        const queueId = addToSyncQueue('transcription', {
          audioBlob,
          language,
          apiKey,
          noteId,
          timestamp: Date.now(),
        });
        
        setQueued(true);
        
        return {
          transcript: '[Transcription queued for when you\'re back online]',
          language,
        };
      }
      
      setError(apiError);
      return null;
    }
  }, [isOnline, addToSyncQueue, setLoading, setError, setQueued]);

  const rewrite = useCallback(async (
    text: string, 
    prompt: string, 
    apiKey: string,
    noteId?: string
  ): Promise<{ rewrittenText: string; originalText: string; prompt: string } | null> => {
    if (!isOnline) {
      // Queue for offline processing
      const queueId = addToSyncQueue('rewrite', {
        text,
        prompt,
        apiKey,
        noteId,
        timestamp: Date.now(),
      });
      
      setQueued(true);
      
      // Return a placeholder result
      return {
        rewrittenText: '[Rewrite queued for when you\'re back online]',
        originalText: text,
        prompt,
      };
    }

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
      
      // If it's a network error and we're offline, queue it
      if (apiError.type === 'network' && !isOnline) {
        const queueId = addToSyncQueue('rewrite', {
          text,
          prompt,
          apiKey,
          noteId,
          timestamp: Date.now(),
        });
        
        setQueued(true);
        
        return {
          rewrittenText: '[Rewrite queued for when you\'re back online]',
          originalText: text,
          prompt,
        };
      }
      
      setError(apiError);
      return null;
    }
  }, [isOnline, addToSyncQueue, setLoading, setError, setQueued]);

  const generateMetadata = useCallback(async (
    transcript: string, 
    apiKey: string,
    noteId?: string
  ): Promise<{ title: string; description: string; keywords: string[] } | null> => {
    if (!isOnline) {
      // For metadata generation, we can provide a fallback
      const words = transcript.split(' ').slice(0, 5).join(' ');
      return {
        title: words.length > 0 ? `${words}...` : 'Voice Note',
        description: transcript.slice(0, 100) + (transcript.length > 100 ? '...' : ''),
        keywords: [],
      };
    }

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
      
      // Provide fallback for metadata generation
      if (apiError.type === 'network' && !isOnline) {
        const words = transcript.split(' ').slice(0, 5).join(' ');
        return {
          title: words.length > 0 ? `${words}...` : 'Voice Note',
          description: transcript.slice(0, 100) + (transcript.length > 100 ? '...' : ''),
          keywords: [],
        };
      }
      
      setError(apiError);
      return null;
    }
  }, [isOnline, setLoading, setError]);

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

// Hook for getting user-friendly error messages with offline context
export function useAPIErrorMessageWithOffline(error: APIError | null, isQueued: boolean): string | null {
  if (isQueued) {
    return 'Request queued - will process when back online';
  }
  
  if (!error) return null;
  return getErrorMessage(error);
}