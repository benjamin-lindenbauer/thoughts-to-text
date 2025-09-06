import { useCallback } from 'react';
import { Note } from '@/types';

interface ShareData {
  title: string;
  text: string;
  files?: File[];
}

export function useWebShare() {
  const isShareSupported = typeof navigator !== 'undefined' && 'share' in navigator;

  const shareNote = useCallback(async (note: Note): Promise<boolean> => {
    try {
      // Prepare share content
      let shareText = `${note.title}\n\n`;
      
      if (note.description) {
        shareText += `${note.description}\n\n`;
      }
      
      // Use rewritten text if available, otherwise use transcript
      const content = note.rewrittenText || note.transcript;
      shareText += content;
      
      if (note.keywords.length > 0) {
        shareText += `\n\nKeywords: ${note.keywords.join(', ')}`;
      }

      const shareData: ShareData = {
        title: note.title || 'Voice Note',
        text: shareText,
      };

      // Add photo file if available and supported
      if (note.photoBlob && 'canShare' in navigator) {
        const photoFile = new File([note.photoBlob], 'note-photo.jpg', {
          type: note.photoBlob.type || 'image/jpeg',
        });
        
        // Check if files can be shared
        if (navigator.canShare({ files: [photoFile] })) {
          shareData.files = [photoFile];
        }
      }

      if (isShareSupported) {
        await navigator.share(shareData);
        return true;
      } else {
        // Fallback: copy to clipboard
        await fallbackShare(shareData);
        return true;
      }
    } catch (error) {
      // User cancelled or error occurred
      if (error instanceof Error && error.name === 'AbortError') {
        // User cancelled, not really an error
        return false;
      }
      
      // Try fallback on error
      try {
        await fallbackShare({
          title: note.title || 'Voice Note',
          text: note.rewrittenText || note.transcript,
        });
        return true;
      } catch (fallbackError) {
        console.error('Share failed:', fallbackError);
        throw fallbackError;
      }
    }
  }, [isShareSupported]);

  const fallbackShare = useCallback(async (data: ShareData) => {
    if ('clipboard' in navigator) {
      // Copy to clipboard
      const textToCopy = `${data.title}\n\n${data.text}`;
      await navigator.clipboard.writeText(textToCopy);
    } else {
      // Very old browser fallback
      const textArea = document.createElement('textarea');
      textArea.value = `${data.title}\n\n${data.text}`;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Fallback copy failed:', err);
        throw new Error('Unable to share or copy note');
      } finally {
        document.body.removeChild(textArea);
      }
    }
  }, []);

  return {
    shareNote,
    isShareSupported,
  };
}