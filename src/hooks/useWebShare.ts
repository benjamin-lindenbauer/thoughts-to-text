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
        return false;
      }
    }
  }, [isShareSupported]);

  const fallbackShare = useCallback(async (data: ShareData) => {
    if ('clipboard' in navigator) {
      // Copy to clipboard
      const textToCopy = `${data.title}\n\n${data.text}`;
      await navigator.clipboard.writeText(textToCopy);
      
      // Show a temporary notification
      showNotification('Note copied to clipboard!');
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
        showNotification('Note copied to clipboard!');
      } catch (err) {
        console.error('Fallback copy failed:', err);
        throw new Error('Unable to share or copy note');
      } finally {
        document.body.removeChild(textArea);
      }
    }
  }, []);

  const showNotification = useCallback((message: string) => {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 3000);
  }, []);

  return {
    shareNote,
    isShareSupported,
  };
}