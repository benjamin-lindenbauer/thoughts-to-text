'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { AppLayout } from "@/components/AppLayout";
import { RecordingInterface } from "@/components/RecordingInterface";
import { AlertCircle, CheckCircle, Sparkles } from "lucide-react";
import { animations } from "@/lib/animations";
import { useAppState } from "@/hooks/useAppState";

const LANGUAGE_OPTIONS = [
  { code: 'auto', name: 'Auto-detect recording language', nativeName: '', flag: '' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', flag: '🇿🇦' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '' },
{ code: 'hy', name: 'Armenian', nativeName: 'Հայերեն', flag: '' },
{ code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan', flag: '🇦🇿' },
{ code: 'be', name: 'Belarusian', nativeName: 'Беларуская', flag: '' },
{ code: 'bs', name: 'Bosnian', nativeName: 'Bosanski', flag: '' },
{ code: 'bg', name: 'Bulgarian', nativeName: 'Български', flag: '🇧🇬' },
{ code: 'ca', name: 'Catalan', nativeName: 'Català', flag: '🇪🇸' },
{ code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
{ code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', flag: '🇭🇷' },
{ code: 'cs', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿' },
{ code: 'da', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰' },
{ code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
{ code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
{ code: 'et', name: 'Estonian', nativeName: 'Eesti', flag: '🇪🇪' },
{ code: 'fi', name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮' },
{ code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
{ code: 'gl', name: 'Galician', nativeName: 'Galego', flag: '🇪🇸' },
{ code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
{ code: 'el', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷' },
{ code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱' },
{ code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
{ code: 'hu', name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺' },
{ code: 'is', name: 'Icelandic', nativeName: 'Íslenska', flag: '🇮🇸' },
{ code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
{ code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
{ code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
{ code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳' },
{ code: 'kk', name: 'Kazakh', nativeName: 'Қазақша', flag: '🇰🇿' },
{ code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
{ code: 'lv', name: 'Latvian', nativeName: 'Latviešu', flag: '🇱🇻' },
{ code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių', flag: '🇱🇹' },
{ code: 'mk', name: 'Macedonian', nativeName: 'Македонски', flag: '🇲🇰' },
{ code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
{ code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
{ code: 'mi', name: 'Maori', nativeName: 'Te Reo Māori', flag: '🇳🇿' },
{ code: 'ne', name: 'Nepali', nativeName: 'नेपाली', flag: '🇳🇵' },
{ code: 'no', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴' },
{ code: 'fa', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷' },
{ code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
{ code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
{ code: 'ro', name: 'Romanian', nativeName: 'Română', flag: '🇷🇴' },
{ code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
{ code: 'sr', name: 'Serbian', nativeName: 'Српски', flag: '🇷🇸' },
{ code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', flag: '🇸🇰' },
{ code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina', flag: '🇸🇮' },
{ code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
{ code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', flag: '🇰🇪' },
{ code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
{ code: 'tl', name: 'Tagalog', nativeName: 'Tagalog', flag: '🇵🇭' },
{ code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
{ code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
{ code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
{ code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
{ code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰' },
{ code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
{ code: 'cy', name: 'Welsh', nativeName: 'Cymraeg', flag: '' },
];

export default function Home() {
  const { state } = useAppState();
  const [selectedLanguage, setSelectedLanguage] = useState('auto');
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
            <Sparkles className="w-6 h-6 text-indigo-500" />
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent leading-tight pb-1">
              Thoughts to Text
            </h1>
            <Sparkles className="w-6 h-6 text-purple-500" />
          </div>
          <p className="text-sm md:text-base text-muted-foreground">
            From raw thoughts to polished text in seconds.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-2 md:p-4 pt-32 md:pt-40 w-full max-w-full">
        <div className="text-center mb-8">
          <p className="text-sm md:text-base text-muted-foreground">
            What's on your mind today?
          </p>
        </div>
        {/* Language selection with enhanced styling */}
        {/*
        <div className={`mb-8 w-full max-w-sm ${isLoaded ? animations.slideInFromTop : 'opacity-0 translate-y-4'}`}>
          <select
            value={selectedLanguage}
            disabled
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className={`w-full p-4 rounded-xl border border-border bg-card text-foreground shadow-sm ${animationPresets.button.idle} hover:shadow-md hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:shadow-lg`}
          >
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.name} {lang.nativeName ? `(${lang.nativeName})` : ''}
              </option>
            ))}
          </select>
        </div>
        */}

        {/* Recording Interface with enhanced container */}
        <div className={`w-full ${isLoaded ? animations.scaleIn : 'opacity-0 scale-95'} transition-all duration-500 delay-200`}>
          <RecordingInterface
            selectedLanguage={selectedLanguage}
            onRecordingComplete={handleRecordingComplete}
            onTranscriptionStart={handleTranscriptionStart}
            onTranscriptionComplete={handleTranscriptionComplete}
            onError={handleError}
          />
        </div>

        {/* Enhanced Notification with better animations */}
        {notification && (
          <div className={`fixed top-4 right-4 left-4 sm:left-auto p-4 rounded-xl shadow-xl flex items-center gap-4 max-w-sm sm:max-w-sm z-50 backdrop-blur-md ${notification.type === 'success'
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
