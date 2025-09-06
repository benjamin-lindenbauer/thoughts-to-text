'use client';

import React, { useState, useCallback } from 'react';
import { AppLayout } from "@/components/AppLayout";
import { RecordingInterface } from "@/components/RecordingInterface";
import { AlertCircle, CheckCircle } from "lucide-react";

const LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
];

export default function Home() {
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Handle recording completion
  const handleRecordingComplete = useCallback((audioBlob: Blob, transcript?: string, photo?: Blob, rewrittenText?: string) => {
    console.log('Recording completed:', {
      audioSize: audioBlob.size,
      hasTranscript: !!transcript,
      hasPhoto: !!photo,
      hasRewrittenText: !!rewrittenText
    });

    // TODO: Save to storage (will be implemented in later tasks)
    setNotification({
      type: 'success',
      message: 'Recording saved successfully!'
    });

    // Clear notification after 3 seconds
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Handle transcription start
  const handleTranscriptionStart = useCallback(() => {
    console.log('Transcription started');
  }, []);

  // Handle transcription completion
  const handleTranscriptionComplete = useCallback((transcript: string) => {
    console.log('Transcription completed:', transcript);
  }, []);

  // Handle errors
  const handleError = useCallback((error: string) => {
    console.error('Recording error:', error);
    setNotification({
      type: 'error',
      message: error
    });

    // Clear notification after 5 seconds for errors
    setTimeout(() => setNotification(null), 5000);
  }, []);

  return (
    <AppLayout>
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="text-center py-4 px-6">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2">
            Thoughts to Text
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-md mx-auto">
            Record your thoughts and rewrite them with AI.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-6 md:p-8 pt-32 md:pt-36">
        {/* Language selection */}
        <div className="mb-8 w-full max-w-sm">
          <label className="block text-sm font-medium text-foreground mb-3">
            Recording Language
          </label>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="w-full p-3 rounded-xl border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.name} ({lang.nativeName})
              </option>
            ))}
          </select>
        </div>

        {/* Recording Interface */}
        <RecordingInterface
          selectedLanguage={selectedLanguage}
          onRecordingComplete={handleRecordingComplete}
          onTranscriptionStart={handleTranscriptionStart}
          onTranscriptionComplete={handleTranscriptionComplete}
          onError={handleError}
          className="mb-8"
        />

        {/* Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg flex items-center gap-3 max-w-sm z-50 ${notification.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200'
            : 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
            }`}>
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <p className="text-sm">{notification.message}</p>
          </div>
        )}

        {/* Quick stats or recent activity hint */}
        <div className="mt-8 md:mt-12 text-center">
          <p className="text-xs text-muted-foreground">
            No recordings yet • Get started by selecting a language and tapping the microphone
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
