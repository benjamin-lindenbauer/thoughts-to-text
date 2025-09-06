# Global State Management

This document explains how to use the global state management system implemented for the Thoughts to Text app.

## Overview

The app uses React Context with useReducer for global state management, providing:
- Centralized state for settings, notes, recording, UI state, and offline operations
- Automatic persistence to localStorage
- SSR-safe hydration
- Type-safe hooks for accessing state
- Optimistic updates with error recovery

## Architecture

### Core Components

1. **AppContext** (`src/contexts/AppContext.tsx`)
   - Main context provider with reducer-based state management
   - Handles state hydration and persistence
   - Monitors online/offline status

2. **State Persistence** (`src/lib/state-persistence.ts`)
   - Utilities for saving/loading state from localStorage
   - Handles storage quota management and cleanup
   - SSR-safe with client-side checks

3. **Custom Hooks** (`src/hooks/useAppState.ts`)
   - Specialized hooks for different parts of the state
   - Provides convenient APIs for common operations

## Usage

### Setup

Wrap your app with the `AppProvider`:

```tsx
import { AppProvider } from '@/contexts/AppContext';

function App() {
  return (
    <AppProvider>
      {/* Your app components */}
    </AppProvider>
  );
}
```

### Using State Hooks

#### Settings Management

```tsx
import { useSettings } from '@/hooks';

function SettingsComponent() {
  const { settings, updateSettings, addRewritePrompt } = useSettings();

  const handleThemeChange = (theme: 'light' | 'dark' | 'auto') => {
    updateSettings({ theme });
  };

  const handleAddPrompt = () => {
    addRewritePrompt({
      name: 'Custom Prompt',
      prompt: 'Your custom prompt here...',
      isDefault: false
    });
  };

  return (
    <div>
      <p>Current theme: {settings.theme}</p>
      <button onClick={() => handleThemeChange('dark')}>
        Switch to Dark
      </button>
    </div>
  );
}
```

#### Notes Management

```tsx
import { useNotes } from '@/hooks';

function NotesComponent() {
  const { notes, addNote, updateNote, deleteNote, selectNote } = useNotes();

  const handleCreateNote = async () => {
    const newNote = {
      id: crypto.randomUUID(),
      title: 'New Note',
      description: '',
      transcript: '',
      audioBlob: new Blob(),
      language: 'en',
      duration: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      keywords: []
    };
    
    await addNote(newNote);
  };

  return (
    <div>
      <button onClick={handleCreateNote}>Create Note</button>
      {notes.map(note => (
        <div key={note.id} onClick={() => selectNote(note.id)}>
          {note.title}
        </div>
      ))}
    </div>
  );
}
```

#### Recording State

```tsx
import { useRecording } from '@/hooks';

function RecordingComponent() {
  const { 
    recording, 
    startRecording, 
    stopRecording, 
    updateDuration 
  } = useRecording();

  const handleStartRecording = () => {
    startRecording();
  };

  const handleStopRecording = (audioBlob: Blob, duration: number) => {
    stopRecording(audioBlob, duration);
  };

  return (
    <div>
      <p>Recording: {recording.isRecording ? 'Active' : 'Inactive'}</p>
      <p>Duration: {recording.duration}s</p>
      <button onClick={handleStartRecording} disabled={recording.isRecording}>
        Start Recording
      </button>
    </div>
  );
}
```

#### UI State

```tsx
import { useUI } from '@/hooks';

function UIComponent() {
  const { isLoading, error, setLoading, setError, clearError } = useUI();

  const handleAsyncOperation = async () => {
    try {
      setLoading(true);
      clearError();
      
      // Perform async operation
      await someAsyncOperation();
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      <button onClick={handleAsyncOperation}>
        Perform Operation
      </button>
    </div>
  );
}
```

#### Offline Queue

```tsx
import { useOfflineQueue } from '@/hooks';

function OfflineComponent() {
  const { 
    pendingTranscriptions, 
    pendingRewrites, 
    hasPendingOperations,
    addPendingTranscription 
  } = useOfflineQueue();

  const handleOfflineTranscription = (request) => {
    addPendingTranscription(request);
  };

  return (
    <div>
      <p>Pending operations: {hasPendingOperations ? 'Yes' : 'No'}</p>
      <p>Transcriptions: {pendingTranscriptions.length}</p>
      <p>Rewrites: {pendingRewrites.length}</p>
    </div>
  );
}
```

### All-in-One Hook

For components that need access to multiple parts of the state:

```tsx
import { useAppState } from '@/hooks';

function ComplexComponent() {
  const { settings, notes, recording, ui, offlineQueue } = useAppState();

  // Access all state through the individual hooks
  const currentTheme = settings.settings.theme;
  const noteCount = notes.notes.length;
  const isRecording = recording.recording.isRecording;
  const isOffline = ui.isOffline;
  const hasPending = offlineQueue.hasPendingOperations;

  return (
    <div>
      <p>Theme: {currentTheme}</p>
      <p>Notes: {noteCount}</p>
      <p>Recording: {isRecording ? 'Yes' : 'No'}</p>
      <p>Offline: {isOffline ? 'Yes' : 'No'}</p>
      <p>Pending: {hasPending ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

## State Persistence

The system automatically persists:
- Selected note ID
- Offline operation queue
- Settings (via separate storage utilities)

Data is automatically loaded on app startup and saved when changes occur.

### Storage Health

Monitor storage usage:

```tsx
import { useStorageHealth } from '@/hooks';

function StorageMonitor() {
  const { storageInfo, isStorageHealthy, cleanupStorage } = useStorageHealth();

  return (
    <div>
      <p>Storage: {storageInfo.percentage.toFixed(1)}% used</p>
      <p>Healthy: {isStorageHealthy ? 'Yes' : 'No'}</p>
      {!isStorageHealthy && (
        <button onClick={cleanupStorage}>Cleanup Storage</button>
      )}
    </div>
  );
}
```

## Development Tools

### Debug Component

Use the debug component to inspect state during development:

```tsx
import { StateDebug, useStateDebug } from '@/components/StateDebug';

function App() {
  const { showDebug } = useStateDebug();

  return (
    <div>
      {/* Your app */}
      <StateDebug show={showDebug} />
    </div>
  );
}
```

Press `Ctrl+Shift+D` to toggle the debug panel.

## Best Practices

1. **Use Specific Hooks**: Use `useSettings()`, `useNotes()`, etc. instead of `useAppState()` when you only need specific functionality.

2. **Handle Errors**: Always handle errors from async operations and use the UI state for loading indicators.

3. **Optimistic Updates**: The system provides optimistic updates - UI changes immediately while persistence happens in the background.

4. **SSR Safety**: All localStorage operations are client-side only and won't cause hydration mismatches.

5. **Type Safety**: All hooks are fully typed - use TypeScript for the best development experience.

## Troubleshooting

### Hydration Errors
If you see hydration errors, ensure you're not accessing browser APIs during server-side rendering. The state management system handles this automatically.

### Storage Issues
If localStorage is full or unavailable, the app will continue to work but won't persist data. Use `useStorageHealth()` to monitor storage status.

### Performance
The state management system is optimized for performance with minimal re-renders. Use React DevTools to profile if needed.