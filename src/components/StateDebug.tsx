'use client';

import React from 'react';
import { useAppState, useAppInitialization, useStorageHealth } from '@/hooks';

interface StateDebugProps {
  show?: boolean;
}

// Debug component to show global state information
export function StateDebug({ show = false }: StateDebugProps) {
  const { state, settings, notes, recording, ui, offlineQueue } = useAppState();
  const { isReady, isHydrating, hasError, initializationError } = useAppInitialization();
  const { storageInfo, isStorageHealthy } = useStorageHealth();

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-sm max-h-96 overflow-auto z-50">
      <h3 className="font-bold mb-2">Global State Debug</h3>
      
      <div className="space-y-2">
        <div>
          <strong>Initialization:</strong>
          <div>Ready: {isReady ? '✅' : '❌'}</div>
          <div>Hydrating: {isHydrating ? '⏳' : '✅'}</div>
          <div>Error: {hasError ? '❌' : '✅'}</div>
          {initializationError && <div className="text-red-300">Error: {initializationError}</div>}
        </div>

        <div>
          <strong>Settings:</strong>
          <div>Loaded: {settings.isLoaded ? '✅' : '❌'}</div>
          <div>API Key: {settings.settings.openaiApiKey ? '✅' : '❌'}</div>
          <div>Theme: {settings.settings.theme}</div>
          <div>Language: {settings.settings.defaultLanguage}</div>
          <div>Prompts: {settings.settings.rewritePrompts.length}</div>
        </div>

        <div>
          <strong>Notes:</strong>
          <div>Loaded: {notes.isLoaded ? '✅' : '❌'}</div>
          <div>Count: {notes.notes.length}</div>
          <div>Selected: {notes.selectedNoteId || 'None'}</div>
        </div>

        <div>
          <strong>Recording:</strong>
          <div>Active: {recording.recording.isRecording ? '🔴' : '⚫'}</div>
          <div>Duration: {recording.recording.duration}s</div>
          <div>Transcribing: {recording.recording.isTranscribing ? '⏳' : '✅'}</div>
          <div>Has Audio: {recording.recording.audioBlob ? '✅' : '❌'}</div>
          <div>Has Transcript: {recording.recording.transcript ? '✅' : '❌'}</div>
        </div>

        <div>
          <strong>UI State:</strong>
          <div>Offline: {ui.isOffline ? '📴' : '🌐'}</div>
          <div>Loading: {ui.isLoading ? '⏳' : '✅'}</div>
          <div>Error: {ui.error || 'None'}</div>
        </div>

        <div>
          <strong>Offline Queue:</strong>
          <div>Transcriptions: {offlineQueue.pendingTranscriptions.length}</div>
          <div>Rewrites: {offlineQueue.pendingRewrites.length}</div>
          <div>Has Pending: {offlineQueue.hasPendingOperations ? '⏳' : '✅'}</div>
        </div>

        <div>
          <strong>Storage:</strong>
          <div>Healthy: {isStorageHealthy ? '✅' : '⚠️'}</div>
          <div>Usage: {storageInfo.percentage.toFixed(1)}%</div>
          <div>Used: {(storageInfo.used / 1024 / 1024).toFixed(2)}MB</div>
          <div>Available: {(storageInfo.available / 1024 / 1024).toFixed(2)}MB</div>
        </div>
      </div>
    </div>
  );
}

// Hook to toggle debug visibility
export function useStateDebug() {
  const [showDebug, setShowDebug] = React.useState(false);

  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Toggle debug with Ctrl+Shift+D
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        setShowDebug(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return { showDebug, setShowDebug };
}