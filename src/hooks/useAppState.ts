'use client';

import { useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Note, AppSettings, RewritePrompt, TranscriptionRequest, RewriteRequest } from '@/types';
import { storeSettings, createNote, updateNote as updateNoteInStorage, deleteNote as deleteNoteFromStorage } from '@/lib/storage';

// Hook for settings management
export function useSettings() {
  const { state, dispatch } = useAppContext();

  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>) => {
    try {
      const updatedSettings = { ...state.settings, ...newSettings };
      
      // Update state immediately for optimistic updates
      dispatch({ type: 'UPDATE_SETTINGS', payload: newSettings });
      
      // Persist to storage
      await storeSettings(updatedSettings);
    } catch (error) {
      console.error('Failed to update settings:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to save settings' });
    }
  }, [state.settings, dispatch]);

  const addRewritePrompt = useCallback(async (prompt: Omit<RewritePrompt, 'id'>) => {
    const newPrompt: RewritePrompt = {
      ...prompt,
      id: crypto.randomUUID()
    };

    const updatedPrompts = [...state.settings.rewritePrompts, newPrompt];
    await updateSettings({ rewritePrompts: updatedPrompts });
  }, [state.settings.rewritePrompts, updateSettings]);

  const updateRewritePrompt = useCallback(async (id: string, updates: Partial<RewritePrompt>) => {
    const updatedPrompts = state.settings.rewritePrompts.map(prompt =>
      prompt.id === id ? { ...prompt, ...updates } : prompt
    );
    await updateSettings({ rewritePrompts: updatedPrompts });
  }, [state.settings.rewritePrompts, updateSettings]);

  const deleteRewritePrompt = useCallback(async (id: string) => {
    const updatedPrompts = state.settings.rewritePrompts.filter(prompt => prompt.id !== id);
    
    // If we're deleting the default prompt, set a new default
    let newDefaultPrompt = state.settings.defaultRewritePrompt;
    if (state.settings.defaultRewritePrompt === id && updatedPrompts.length > 0) {
      newDefaultPrompt = updatedPrompts[0].id;
    }

    await updateSettings({ 
      rewritePrompts: updatedPrompts,
      defaultRewritePrompt: newDefaultPrompt
    });
  }, [state.settings.rewritePrompts, state.settings.defaultRewritePrompt, updateSettings]);

  return {
    settings: state.settings,
    isLoaded: state.isSettingsLoaded,
    updateSettings,
    addRewritePrompt,
    updateRewritePrompt,
    deleteRewritePrompt
  };
}

// Hook for notes management
export function useNotes() {
  const { state, dispatch } = useAppContext();

  const addNote = useCallback(async (note: Note) => {
    try {
      // Update state immediately for optimistic updates
      dispatch({ type: 'ADD_NOTE', payload: note });
      
      // Persist to storage
      await createNote(note);
    } catch (error) {
      console.error('Failed to add note:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to save note' });
      // Revert optimistic update by removing the note
      dispatch({ type: 'DELETE_NOTE', payload: note.id });
    }
  }, [dispatch]);

  const updateNote = useCallback(async (note: Note) => {
    try {
      // Update state immediately for optimistic updates
      dispatch({ type: 'UPDATE_NOTE', payload: note });
      
      // Persist to storage
      await updateNoteInStorage(note);
    } catch (error) {
      console.error('Failed to update note:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to update note' });
    }
  }, [dispatch]);

  const deleteNote = useCallback(async (id: string) => {
    try {
      // Update state immediately for optimistic updates
      dispatch({ type: 'DELETE_NOTE', payload: id });
      
      // Remove from storage
      await deleteNoteFromStorage(id);
    } catch (error) {
      console.error('Failed to delete note:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to delete note' });
    }
  }, [dispatch]);

  const selectNote = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_NOTE', payload: id });
  }, [dispatch]);

  const getNote = useCallback((id: string): Note | undefined => {
    return state.notes.find(note => note.id === id);
  }, [state.notes]);

  const searchNotes = useCallback((query: string): Note[] => {
    if (!query.trim()) return state.notes;
    
    const lowercaseQuery = query.toLowerCase();
    return state.notes.filter(note => 
      note.title.toLowerCase().includes(lowercaseQuery) ||
      note.description.toLowerCase().includes(lowercaseQuery) ||
      note.transcript.toLowerCase().includes(lowercaseQuery) ||
      (note.rewrittenText && note.rewrittenText.toLowerCase().includes(lowercaseQuery)) ||
      note.keywords.some(keyword => keyword.toLowerCase().includes(lowercaseQuery))
    );
  }, [state.notes]);

  return {
    notes: state.notes,
    selectedNoteId: state.selectedNoteId,
    selectedNote: state.selectedNoteId ? getNote(state.selectedNoteId) : undefined,
    isLoaded: state.isNotesLoaded,
    addNote,
    updateNote,
    deleteNote,
    selectNote,
    getNote,
    searchNotes
  };
}

// Hook for recording state management
export function useRecording() {
  const { state, dispatch } = useAppContext();

  const startRecording = useCallback(() => {
    dispatch({ type: 'START_RECORDING' });
  }, [dispatch]);

  const stopRecording = useCallback((audioBlob: Blob, duration: number) => {
    dispatch({ type: 'STOP_RECORDING', payload: { audioBlob, duration } });
  }, [dispatch]);

  const updateDuration = useCallback((duration: number) => {
    dispatch({ type: 'UPDATE_RECORDING_DURATION', payload: duration });
  }, [dispatch]);

  const startTranscription = useCallback(() => {
    dispatch({ type: 'START_TRANSCRIPTION' });
  }, [dispatch]);

  const completeTranscription = useCallback((transcript: string) => {
    dispatch({ type: 'COMPLETE_TRANSCRIPTION', payload: transcript });
  }, [dispatch]);

  const resetRecording = useCallback(() => {
    dispatch({ type: 'RESET_RECORDING' });
  }, [dispatch]);

  return {
    recording: state.recording,
    startRecording,
    stopRecording,
    updateDuration,
    startTranscription,
    completeTranscription,
    resetRecording
  };
}

// Hook for UI state management
export function useUI() {
  const { state, dispatch } = useAppContext();

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, [dispatch]);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, [dispatch]);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, [dispatch]);

  return {
    isOffline: state.isOffline,
    isLoading: state.isLoading,
    error: state.error,
    setLoading,
    setError,
    clearError
  };
}

// Hook for offline queue management
export function useOfflineQueue() {
  const { state, dispatch } = useAppContext();

  const addPendingTranscription = useCallback((request: TranscriptionRequest) => {
    dispatch({ type: 'ADD_PENDING_TRANSCRIPTION', payload: request });
  }, [dispatch]);

  const removePendingTranscription = useCallback((noteId: string) => {
    dispatch({ type: 'REMOVE_PENDING_TRANSCRIPTION', payload: noteId });
  }, [dispatch]);

  const addPendingRewrite = useCallback((request: RewriteRequest) => {
    dispatch({ type: 'ADD_PENDING_REWRITE', payload: request });
  }, [dispatch]);

  const removePendingRewrite = useCallback((noteId: string) => {
    dispatch({ type: 'REMOVE_PENDING_REWRITE', payload: noteId });
  }, [dispatch]);

  return {
    pendingTranscriptions: state.pendingTranscriptions,
    pendingRewrites: state.pendingRewrites,
    hasPendingOperations: state.pendingTranscriptions.length > 0 || state.pendingRewrites.length > 0,
    addPendingTranscription,
    removePendingTranscription,
    addPendingRewrite,
    removePendingRewrite
  };
}

// Main hook that provides access to all app state
export function useAppState() {
  const { state } = useAppContext();
  
  return {
    // Individual hooks for specific functionality
    settings: useSettings(),
    notes: useNotes(),
    recording: useRecording(),
    ui: useUI(),
    offlineQueue: useOfflineQueue(),
    
    // Raw state access if needed
    state
  };
}