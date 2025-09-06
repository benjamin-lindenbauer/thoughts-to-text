// Core TypeScript interfaces for Thoughts to Text app

export interface Note {
  id: string;
  title: string;
  description: string;
  transcript: string;
  rewrittenText?: string;
  audioBlob: Blob;
  photoBlob?: Blob;
  language: string;
  duration: number;
  createdAt: Date;
  updatedAt: Date;
  keywords: string[];
}

export interface AppSettings {
  openaiApiKey: string;
  defaultLanguage: string;
  theme: 'light' | 'dark' | 'auto';
  rewritePrompts: RewritePrompt[];
  defaultRewritePrompt: string;
}

export interface RewritePrompt {
  id: string;
  name: string;
  prompt: string;
  isDefault: boolean;
}

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  audioBlob?: Blob;
  isTranscribing: boolean;
  transcript?: string;
}

// Additional utility types
export interface APIError {
  type: 'network' | 'auth' | 'quota' | 'server' | 'unknown';
  message: string;
  retryable: boolean;
  retryAfter?: number;
}

export interface TranscriptionRequest {
  audioBlob: Blob;
  language: string;
  noteId: string;
}

export interface RewriteRequest {
  text: string;
  prompt: string;
  noteId: string;
}

// Language options for speech-to-text
export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
}

// Storage-related types
export interface StorageQuota {
  used: number;
  available: number;
  percentage: number;
}

// Error handling types
export interface ErrorRecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export interface ErrorContext {
  operation?: string;
  component?: string;
  userId?: string;
  sessionId?: string;
  [key: string]: any;
}

// PWA-related types
export interface PWAInstallPrompt {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Theme-related types
export type ThemeMode = 'light' | 'dark' | 'auto';

// Audio-related types
export interface AudioRecordingOptions {
  mimeType?: string;
  audioBitsPerSecond?: number;
  sampleRate?: number;
}

export interface AudioPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

// Global App State types
export interface AppState {
  // Settings
  settings: AppSettings;
  isSettingsLoaded: boolean;
  
  // Notes
  notes: Note[];
  isNotesLoaded: boolean;
  selectedNoteId: string | null;
  
  // Recording state
  recording: RecordingState;
  
  // UI state
  isOffline: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Queue for offline operations
  pendingTranscriptions: TranscriptionRequest[];
  pendingRewrites: RewriteRequest[];
}

export type AppAction =
  // Settings actions
  | { type: 'LOAD_SETTINGS'; payload: AppSettings }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'SETTINGS_LOADED' }
  
  // Notes actions
  | { type: 'LOAD_NOTES'; payload: Note[] }
  | { type: 'ADD_NOTE'; payload: Note }
  | { type: 'UPDATE_NOTE'; payload: Note }
  | { type: 'DELETE_NOTE'; payload: string }
  | { type: 'SELECT_NOTE'; payload: string | null }
  | { type: 'NOTES_LOADED' }
  
  // Recording actions
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING'; payload: { audioBlob: Blob; duration: number } }
  | { type: 'UPDATE_RECORDING_DURATION'; payload: number }
  | { type: 'START_TRANSCRIPTION' }
  | { type: 'COMPLETE_TRANSCRIPTION'; payload: string }
  | { type: 'RESET_RECORDING' }
  
  // UI actions
  | { type: 'SET_OFFLINE'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  
  // Queue actions
  | { type: 'ADD_PENDING_TRANSCRIPTION'; payload: TranscriptionRequest }
  | { type: 'REMOVE_PENDING_TRANSCRIPTION'; payload: string }
  | { type: 'ADD_PENDING_REWRITE'; payload: RewriteRequest }
  | { type: 'REMOVE_PENDING_REWRITE'; payload: string }
  
  // Hydration action
  | { type: 'HYDRATE_STATE'; payload: Partial<AppState> };