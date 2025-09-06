'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { AppLayout } from "@/components/AppLayout";
import { RecordingInterface } from "@/components/RecordingInterface";
import { AlertCircle, CheckCircle, Sparkles } from "lucide-react";
import { animations, animationPresets } from "@/lib/animations";
import { useAppState } from "@/hooks/useAppState";

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
  const { state } = useAppState();
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize component with animation
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Handle recording completion
  const handleRecordingComplete = useCallback((audioBlob: Blob, transcript?: string, photo?: Blob, rewrittenText?: string) => {
    console.log('Recording completed:', {
      audioSize: audioBlob.size,
      hasTranscript: !!transcript,
      hasPhoto: !!photo,
      hasRewrittenText: !!rewrittenText
    });

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
      {/* Fixed Header with gradient background */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-gradient-to-b from-background via-background/95 to-background/80 backdrop-blur-md border-b border-border/50">
        <div className={`text-center py-6 px-6 ${isLoaded ? animations.fadeIn : 'opacity-0'}`}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-indigo-500 animate-pulse" />
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent leading-tight pb-1">
              Thoughts to Text
            </h1>
            <Sparkles className="w-6 h-6 text-purple-500 animate-pulse" />
          </div>
          <p className="text-sm md:text-base text-muted-foreground">
            Record your thoughts and rewrite them with AI
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-2 md:p-4 pt-40 md:pt-44 w-full max-w-full">
        {/* Language selection with enhanced styling */}
        <div className={`mb-8 w-full max-w-sm ${isLoaded ? animations.slideInFromTop : 'opacity-0 translate-y-4'}`}>
          <label className="block text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            Recording Language
          </label>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className={`w-full p-4 rounded-xl border border-border bg-card text-foreground shadow-sm ${animationPresets.button.idle} hover:shadow-md hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-lg`}
          >
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.name} ({lang.nativeName})
              </option>
            ))}
          </select>
        </div>

        {/* Recording Interface with enhanced container */}
        <div className={`w-full mb-8 ${isLoaded ? animations.scaleIn : 'opacity-0 scale-95'} transition-all duration-500 delay-200`}>
          <RecordingInterface
            selectedLanguage={selectedLanguage}
            onRecordingComplete={handleRecordingComplete}
            onTranscriptionStart={handleTranscriptionStart}
            onTranscriptionComplete={handleTranscriptionComplete}
            onError={handleError}
            className="w-full p-4"
          />
        </div>

        {/* Enhanced Notification with better animations */}
        {notification && (
          <div className={`fixed top-4 right-4 left-4 sm:left-auto p-4 rounded-xl shadow-xl flex items-center gap-3 max-w-sm sm:max-w-sm z-50 backdrop-blur-md ${notification.type === 'success'
            ? 'bg-green-50/90 border border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-200'
            : 'bg-red-50/90 border border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200'
            } ${animations.slideInFromTop}`}>
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 animate-pulse" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 animate-bounce" />
            )}
            <p className="text-sm font-medium">{notification.message}</p>
          </div>
        )}

        {/* Subtle background decoration */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none w-full h-full">
          <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl animate-pulse transform -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000 transform translate-x-1/2 translate-y-1/2"></div>
        </div>
      </div>
    </AppLayout>
  );
}
