'use client';

import React, { createContext, useContext, useReducer, useEffect, useState, ReactNode } from 'react';
import { AppState, AppAction, AppSettings } from '@/types';
import { retrieveSettings, getAllNotes, storeSettings } from '@/lib/storage';
import { StatePersistence } from '@/lib/state-persistence';
import { DEFAULT_REWRITE_PROMPTS } from '@/lib/utils';

// Initial state
const initialState: AppState = {
  // Settings
  settings: {
    openaiApiKey: '',
    defaultLanguage: 'en',
    theme: 'auto',
    rewritePrompts: [
      {
        id: 'default',
        name: 'Improve and Structure',
        prompt: 'Please improve the following text by making it clearer, more structured, and well-formatted while preserving the original meaning and intent:',
        isDefault: true
      }
    ],
    defaultRewritePrompt: 'default'
  },
  isSettingsLoaded: false,
  
  // Notes
  notes: [],
  isNotesLoaded: false,
  selectedNoteId: null,
  
  // Recording state
  recording: {
    isRecording: false,
    duration: 0,
    isTranscribing: false
  },
  
  // UI state
  isOffline: false,
  isLoading: false,
  error: null,
  
  // Queue for offline operations
  pendingTranscriptions: [],
  pendingRewrites: []
};

// Reducer function
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // Settings actions
    case 'LOAD_SETTINGS':
      return {
        ...state,
        settings: action.payload
      };
    
    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload
        }
      };
    
    case 'SETTINGS_LOADED':
      return {
        ...state,
        isSettingsLoaded: true
      };
    
    // Notes actions
    case 'LOAD_NOTES':
      return {
        ...state,
        notes: action.payload
      };
    
    case 'ADD_NOTE':
      return {
        ...state,
        notes: [action.payload, ...state.notes]
      };
    
    case 'UPDATE_NOTE':
      return {
        ...state,
        notes: state.notes.map(note => 
          note.id === action.payload.id ? action.payload : note
        )
      };
    
    case 'DELETE_NOTE':
      return {
        ...state,
        notes: state.notes.filter(note => note.id !== action.payload),
        selectedNoteId: state.selectedNoteId === action.payload ? null : state.selectedNoteId
      };
    
    case 'SELECT_NOTE':
      return {
        ...state,
        selectedNoteId: action.payload
      };
    
    case 'NOTES_LOADED':
      return {
        ...state,
        isNotesLoaded: true
      };
    
    // Recording actions
    case 'START_RECORDING':
      return {
        ...state,
        recording: {
          ...state.recording,
          isRecording: true,
          duration: 0,
          audioBlob: undefined,
          transcript: undefined
        }
      };
    
    case 'STOP_RECORDING':
      return {
        ...state,
        recording: {
          ...state.recording,
          isRecording: false,
          audioBlob: action.payload.audioBlob,
          duration: action.payload.duration
        }
      };
    
    case 'UPDATE_RECORDING_DURATION':
      return {
        ...state,
        recording: {
          ...state.recording,
          duration: action.payload
        }
      };
    
    case 'START_TRANSCRIPTION':
      return {
        ...state,
        recording: {
          ...state.recording,
          isTranscribing: true
        }
      };
    
    case 'COMPLETE_TRANSCRIPTION':
      return {
        ...state,
        recording: {
          ...state.recording,
          isTranscribing: false,
          transcript: action.payload
        }
      };
    
    case 'RESET_RECORDING':
      return {
        ...state,
        recording: {
          isRecording: false,
          duration: 0,
          isTranscribing: false
        }
      };
    
    // UI actions
    case 'SET_OFFLINE':
      return {
        ...state,
        isOffline: action.payload
      };
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload
      };
    
    // Queue actions
    case 'ADD_PENDING_TRANSCRIPTION':
      return {
        ...state,
        pendingTranscriptions: [...state.pendingTranscriptions, action.payload]
      };
    
    case 'REMOVE_PENDING_TRANSCRIPTION':
      return {
        ...state,
        pendingTranscriptions: state.pendingTranscriptions.filter(
          req => req.noteId !== action.payload
        )
      };
    
    case 'ADD_PENDING_REWRITE':
      return {
        ...state,
        pendingRewrites: [...state.pendingRewrites, action.payload]
      };
    
    case 'REMOVE_PENDING_REWRITE':
      return {
        ...state,
        pendingRewrites: state.pendingRewrites.filter(
          req => req.noteId !== action.payload
        )
      };
    
    // Hydration action
    case 'HYDRATE_STATE':
      return {
        ...state,
        ...action.payload
      };
    
    default:
      return state;
  }
}

// Context type
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

// Create context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [isMounted, setIsMounted] = useState(false);

  // Track client-side mounting to prevent hydration mismatches
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Hydrate state on mount
  useEffect(() => {
    // Only run on client side after mounting
    if (!isMounted) return;

    async function hydrateState() {
      try {
        // Initialize storage system
        await StatePersistence.initialize();

        // Load persisted UI state
        const persistedState = StatePersistence.loadPersistedState();
        if (persistedState) {
          dispatch({ type: 'HYDRATE_STATE', payload: persistedState });
        }

        // Load offline queue
        const offlineQueue = StatePersistence.loadOfflineQueue();
        dispatch({ type: 'HYDRATE_STATE', payload: {
          pendingTranscriptions: offlineQueue.pendingTranscriptions,
          pendingRewrites: offlineQueue.pendingRewrites
        }});

        // Load settings from storage
        let settings = await retrieveSettings();
        if (settings) {
          dispatch({ type: 'LOAD_SETTINGS', payload: settings });
        } else {
          // Only initialize defaults if settings key is not present at all (first run)
          const existingRaw = localStorage.getItem('thoughts-to-text-settings');
          if (existingRaw === null) {
            const defaultSettings: AppSettings = {
              openaiApiKey: '',
              defaultLanguage: 'en',
              theme: 'auto',
              rewritePrompts: DEFAULT_REWRITE_PROMPTS,
              defaultRewritePrompt: 'default'
            };
            await storeSettings(defaultSettings);
            dispatch({ type: 'LOAD_SETTINGS', payload: defaultSettings });
          }
          // If the key exists but retrieval failed (e.g., corrupted), do not overwrite existing data
        }
        dispatch({ type: 'SETTINGS_LOADED' });

        // Load notes from storage
        const notes = await getAllNotes();
        dispatch({ type: 'LOAD_NOTES', payload: notes });
        dispatch({ type: 'NOTES_LOADED' });

      } catch (error) {
        console.error('Failed to hydrate state:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load app data' });
      }
    }

    hydrateState();
  }, [isMounted]);

  // Persist state changes
  useEffect(() => {
    // Only run on client side after mounting
    if (!isMounted) return;
    
    if (state.isSettingsLoaded && state.isNotesLoaded) {
      // Persist UI state
      StatePersistence.savePersistedState(state);
      
      // Persist offline queue separately
      StatePersistence.saveOfflineQueue(state.pendingTranscriptions, state.pendingRewrites);
    }
  }, [state, isMounted]);

  // Monitor online/offline status
  useEffect(() => {
    // Only run on client side after mounting
    if (!isMounted) return;

    function handleOnline() {
      dispatch({ type: 'SET_OFFLINE', payload: false });
    }

    function handleOffline() {
      dispatch({ type: 'SET_OFFLINE', payload: true });
    }

    // Set initial status (only on client)
    if (typeof navigator !== 'undefined') {
      dispatch({ type: 'SET_OFFLINE', payload: !navigator.onLine });
    }

    // Listen for changes
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isMounted]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Hook to use the app context
export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}