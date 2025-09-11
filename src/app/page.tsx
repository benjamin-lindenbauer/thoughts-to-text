'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from "@/components/AppLayout";
import { RecordingInterface } from "@/components/RecordingInterface";
import { Sparkles } from "lucide-react";
import { animations } from "@/lib/animations";
import { Note } from "@/types";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/Toast";

export default function Home() {
  const router = useRouter();
  const { toasts, removeToast, success, error: showError } = useToast();
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize component with animation
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Handle save after user clicks Save in RecordingInterface
  const handleSave = useCallback((noteId: string, note: Note) => {
    console.log('Recording saved:', {
      noteId,
      title: note.title,
      hasTranscript: !!note.transcript,
      hasPhoto: !!note.photoBlob,
      hasRewrittenText: !!note.rewrittenText
    });

    success('Recording saved successfully!', 'Redirecting...');

    // Try to prefetch the note details route so it works offline
    try {
      router.prefetch(`/notes/${noteId}`);
    } catch (_e) {
      // ignore
    }

    // Navigate to the newly created note after a short delay
    setTimeout(() => {
      router.push(`/notes/${noteId}`);
    }, 2000);
  }, [router]);

  // Handle errors
  const handleError = useCallback((error: string) => {
    console.error('Recording error:', error);
    showError(error);
  }, []);

  return (
    <AppLayout>
      <div className={`w-full h-full flex flex-col items-center text-center py-2 mb-6 ${isLoaded ? animations.fadeIn : 'opacity-0'}`}>
        <div className="flex items-center justify-center gap-2 w-full">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          <h1 className="text-3xl md:text-4xl font-bold gradient-text leading-12">
            Thoughts to Text
          </h1>
          <Sparkles className="w-5 h-5 text-purple-500" />
        </div>
        <p className="text-sm md:text-base text-muted-foreground">
          From raw thoughts to polished text in seconds.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center w-full">
        {/* Recording Interface with enhanced card container */}
        <div className={`w-full ${isLoaded ? animations.scaleIn : 'opacity-0 scale-95'} transition-all duration-500 delay-200`}>
          <RecordingInterface
            onSave={handleSave}
            onError={handleError}
          />
        </div>

        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

        {/* Subtle background decoration */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none w-full h-full">
          <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl animate-pulse transform -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000 transform translate-x-1/2 translate-y-1/2"></div>
        </div>
      </div>
    </AppLayout>
  );
}
