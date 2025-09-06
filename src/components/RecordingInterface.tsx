'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Mic, MicOff, Camera, Square, Wand2, RefreshCw } from 'lucide-react';
import { useRecording } from '@/hooks/useRecording';
import { cn } from '@/lib/utils';
import { RewritePrompt } from '@/types';

interface RecordingInterfaceProps {
  selectedLanguage: string;
  onRecordingComplete?: (audioBlob: Blob, transcript?: string, photo?: Blob, rewrittenText?: string) => void;
  onTranscriptionStart?: () => void;
  onTranscriptionComplete?: (transcript: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

// Default rewrite prompts
const DEFAULT_REWRITE_PROMPTS: RewritePrompt[] = [
  {
    id: 'default',
    name: 'Clean & Polish',
    prompt: 'Please clean up and polish this text, fixing any grammar issues, improving clarity, and making it more professional while maintaining the original meaning and tone.',
    isDefault: true
  },
  {
    id: 'summarize',
    name: 'Summarize',
    prompt: 'Please create a concise summary of this text, capturing the main points and key ideas.',
    isDefault: false
  },
  {
    id: 'expand',
    name: 'Expand & Detail',
    prompt: 'Please expand on this text, adding more detail, context, and explanation while maintaining the original ideas.',
    isDefault: false
  },
  {
    id: 'formal',
    name: 'Make Formal',
    prompt: 'Please rewrite this text in a formal, professional tone suitable for business or academic contexts.',
    isDefault: false
  }
];

export function RecordingInterface({
  selectedLanguage,
  onRecordingComplete,
  onTranscriptionStart,
  onTranscriptionComplete,
  onError,
  className
}: RecordingInterfaceProps) {
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewrittenText, setRewrittenText] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string>('default');
  const [rewritePrompts] = useState<RewritePrompt[]>(DEFAULT_REWRITE_PROMPTS);
  const [isMounted, setIsMounted] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Track client-side mounting to prevent hydration mismatches
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const {
    recordingState,
    startRecording,
    stopRecording,
    isSupported,
    error: recordingError,
    formattedDuration,
    clearError
  } = useRecording({
    autoCompress: true,
    compressionQuality: 0.8,
    maxDuration: 10 * 60 * 1000 // 10 minutes max
  });

  // Handle recording button click
  const handleRecordingToggle = useCallback(async () => {
    clearError();
    
    if (recordingState.isRecording) {
      stopRecording();
    } else {
      // Clear previous transcript and rewritten text when starting new recording
      setTranscript(null);
      setRewrittenText(null);
      
      try {
        await startRecording();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
        onError?.(errorMessage);
      }
    }
  }, [recordingState.isRecording, startRecording, stopRecording, clearError, onError]);

  // Handle photo capture from camera
  const handleCameraCapture = useCallback(async () => {
    // Only run on client side
    if (!isMounted || typeof navigator === 'undefined') return;
    
    if (isCameraActive) {
      // Stop camera and capture photo
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        if (context) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0);
          
          canvas.toBlob((blob) => {
            if (blob && typeof URL !== 'undefined') {
              setPhoto(blob);
              setPhotoPreview(URL.createObjectURL(blob));
            }
          }, 'image/jpeg', 0.8);
        }
      }
      
      // Stop camera stream
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      setIsCameraActive(false);
    } else {
      // Start camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setIsCameraActive(true);
      } catch (error) {
        onError?.('Failed to access camera. Please check permissions.');
      }
    }
  }, [isCameraActive, onError, isMounted]);

  // Handle photo upload from file
  const handlePhotoUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/') && typeof URL !== 'undefined') {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  }, []);

  // Handle transcription
  const handleTranscription = useCallback(async (audioBlob: Blob) => {
    if (!audioBlob) return;

    setIsTranscribing(true);
    onTranscriptionStart?.();

    try {
      // Get API key from encrypted storage
      const { retrieveApiKey } = await import('@/lib/storage');
      const apiKey = await retrieveApiKey();
      
      if (!apiKey) {
        throw new Error('OpenAI API key not configured. Please set your API key in settings.');
      }

      // Use the API utility function
      const { transcribeAudio } = await import('@/lib/api');
      const result = await transcribeAudio(audioBlob, selectedLanguage, apiKey);

      setTranscript(result.transcript);
      onTranscriptionComplete?.(result.transcript);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
      onError?.(errorMessage);
    } finally {
      setIsTranscribing(false);
    }
  }, [selectedLanguage, onTranscriptionStart, onTranscriptionComplete, onError]);

  // Handle text rewriting
  const handleRewrite = useCallback(async () => {
    if (!transcript) return;

    setIsRewriting(true);

    try {
      // Get API key from encrypted storage
      const { retrieveApiKey } = await import('@/lib/storage');
      const apiKey = await retrieveApiKey();
      
      if (!apiKey) {
        throw new Error('OpenAI API key not configured. Please set your API key in settings.');
      }

      const selectedPromptObj = rewritePrompts.find(p => p.id === selectedPrompt);
      if (!selectedPromptObj) {
        throw new Error('Selected rewrite prompt not found.');
      }

      // Use the API utility function
      const { rewriteText } = await import('@/lib/api');
      const result = await rewriteText(transcript, selectedPromptObj.prompt, apiKey);

      if (!result.rewrittenText) {
        throw new Error('No rewritten text was generated. Please try again.');
      }

      setRewrittenText(result.rewrittenText);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Rewriting failed';
      onError?.(errorMessage);
      // Keep original transcript as fallback - don't clear existing rewritten text
    } finally {
      setIsRewriting(false);
    }
  }, [transcript, selectedPrompt, rewritePrompts, onError]);

  // Handle recording completion
  React.useEffect(() => {
    if (recordingState.audioBlob && !recordingState.isRecording) {
      // Automatically start transcription after recording
      handleTranscription(recordingState.audioBlob);
      
      // Call completion callback with rewritten text if available
      onRecordingComplete?.(recordingState.audioBlob, transcript || undefined, photo || undefined, rewrittenText || undefined);
    }
  }, [recordingState.audioBlob, recordingState.isRecording, handleTranscription, onRecordingComplete, transcript, photo, rewrittenText]);

  // Handle recording errors
  React.useEffect(() => {
    if (recordingError) {
      onError?.(recordingError);
    }
  }, [recordingError, onError]);

  // Don't render anything during SSR to prevent hydration mismatches
  if (!isMounted) {
    return (
      <div className={cn("flex flex-col items-center gap-6 mb-8", className)}>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className={cn("flex flex-col items-center gap-6 mb-8", className)}>
        <div className="text-red-500 mb-4">
          <MicOff className="w-12 h-12 mx-auto mb-2" />
          <p className="font-medium">Recording Not Supported</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your browser doesn't support audio recording
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-6 mb-8", className)}>
      {/* Camera preview or photo preview */}
      {(isCameraActive || photoPreview) && (
        <div className="relative w-full max-w-sm">
          {isCameraActive ? (
            <video
              ref={videoRef}
              className="w-full rounded-lg shadow-lg"
              autoPlay
              playsInline
              muted
            />
          ) : photoPreview ? (
            <img
              src={photoPreview}
              alt="Captured"
              className="w-full rounded-lg shadow-lg"
            />
          ) : null}
          
          {photoPreview && (
            <button
              onClick={() => {
                setPhoto(null);
                setPhotoPreview(null);
                if (photoPreview && typeof URL !== 'undefined') {
                  URL.revokeObjectURL(photoPreview);
                }
              }}
              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            >
              <Square className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Recording button */}
      <div className="relative">
        <button
          onClick={handleRecordingToggle}
          disabled={isTranscribing}
          className={cn(
            "relative w-28 h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl active:scale-95 touch-manipulation",
            recordingState.isRecording
              ? "bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
              : "bg-gradient-to-br from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600",
            isTranscribing && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="absolute inset-2 md:inset-3 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            {recordingState.isRecording ? (
              <Square className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 text-white drop-shadow-sm" />
            ) : (
              <Mic className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 text-white drop-shadow-sm" />
            )}
          </div>
          
          {/* Pulse animation ring when recording */}
          {recordingState.isRecording && (
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-500 to-red-600 animate-pulse opacity-30"></div>
          )}
        </button>
      </div>

      {/* Duration display */}
      {(recordingState.isRecording || recordingState.duration > 0) && (
        <div className="text-center">
          <div className="text-2xl md:text-3xl font-mono font-bold text-foreground">
            {formattedDuration}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {recordingState.isRecording ? 'Recording...' : 'Recording complete'}
          </p>
        </div>
      )}

      {/* Status text */}
      {!recordingState.isRecording && recordingState.duration === 0 && (
        <div className="text-center">
          <p className="text-sm md:text-base text-muted-foreground">
            {isTranscribing ? 'Processing...' : 'Tap to start recording'}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Hold for continuous recording
          </p>
        </div>
      )}

      {/* Transcription status */}
      {isTranscribing && (
        <div className="text-center">
          <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">
            Transcribing audio...
          </p>
        </div>
      )}

      {/* Transcript preview */}
      {transcript && (
        <div className="w-full max-w-md space-y-4">
          <div className="p-4 bg-card border border-border rounded-lg">
            <h3 className="font-medium text-foreground mb-2">Original Transcript:</h3>
            <p className="text-sm text-muted-foreground">{transcript}</p>
          </div>

          {/* Rewrite prompt selection and button */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Rewrite Style:
              </label>
              <select 
                value={selectedPrompt}
                onChange={(e) => setSelectedPrompt(e.target.value)}
                disabled={isRewriting}
                className="w-full p-2 rounded-lg border border-border bg-card text-foreground text-sm transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
              >
                {rewritePrompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRewrite}
              disabled={isRewriting || !transcript}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200",
                "bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600",
                "text-white shadow-sm hover:shadow-md active:scale-95",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm disabled:active:scale-100"
              )}
            >
              {isRewriting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Rewriting...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>Rewrite Text</span>
                </>
              )}
            </button>
          </div>

          {/* Rewritten text display */}
          {rewrittenText && (
            <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-foreground flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-indigo-500" />
                  Enhanced Text:
                </h3>
                <button
                  onClick={() => setRewrittenText(null)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title="Clear rewritten text"
                >
                  Clear
                </button>
              </div>
              <p className="text-sm text-foreground">{rewrittenText}</p>
            </div>
          )}
        </div>
      )}

      {/* Photo controls */}
      <div className="flex gap-3">
        <button
          onClick={handleCameraCapture}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-accent transition-colors"
        >
          <Camera className="w-4 h-4" />
          <span className="text-sm">
            {isCameraActive ? 'Capture' : 'Camera'}
          </span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-accent transition-colors"
        >
          <span className="text-sm">Upload Photo</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          className="hidden"
        />
      </div>
    </div>
  );
}