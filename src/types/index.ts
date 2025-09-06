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