// Export all custom hooks for easier importing
export { useAppState, useSettings, useNotes, useRecording, useUI, useOfflineQueue } from './useAppState';
export { useAppInitialization, useStorageHealth } from './useAppInitialization';

// Re-export existing hooks
export { useTheme } from '@/contexts/ThemeContext';