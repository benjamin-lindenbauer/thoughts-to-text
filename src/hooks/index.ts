// Export all custom hooks for easier importing
export { useAppState, useSettings, useNotes, useUI, useOfflineQueue } from './useAppState';
export { useAppInitialization, useStorageHealth } from './useAppInitialization';

// Re-export existing hooks
export { useTheme } from '@/contexts/ThemeContext';

// Export new accessibility and performance hooks
export { useKeyboardNavigation, useFocusManagement } from './useKeyboardNavigation';
export { useAriaLiveRegion, useFocusTrap, useReducedMotion, useScreenReader, useHighContrast } from './useAccessibility';
export { useHapticFeedback } from './useHapticFeedback';