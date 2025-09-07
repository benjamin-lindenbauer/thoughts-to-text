import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import App from '@/app/page';

// Mock Next.js router
const mockPush = vi.fn();
const mockPathname = '/';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    pathname: mockPathname,
  }),
  usePathname: () => mockPathname,
}));

// Mock MediaRecorder
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  state: 'inactive',
  ondataavailable: null,
  onstop: null,
};

global.MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder);
(global.MediaRecorder as any).isTypeSupported = vi.fn().mockReturnValue(true);

// Mock getUserMedia
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
});

// Mock Web Share API
Object.defineProperty(navigator, 'share', {
  value: vi.fn().mockResolvedValue(undefined),
});

Object.defineProperty(navigator, 'canShare', {
  value: vi.fn().mockReturnValue(true),
});

// Mock fetch
global.fetch = vi.fn();

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <AppProvider>
      {children}
    </AppProvider>
  </ThemeProvider>
);

describe('Critical User Journeys (E2E)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset localStorage
    localStorageMock.clear();
    // Set up default API key
    localStorageMock.setItem('openai-api-key', 'sk-test-key-' + 'a'.repeat(40));
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Complete Recording and Transcription Journey', () => {
    it('should complete full user journey from recording to note creation', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // Mock successful transcription
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcript: 'This is my important meeting note about project deadlines',
          language: 'en',
        }),
      } as Response);

      // Mock successful metadata generation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rewrittenText: JSON.stringify({
            title: 'Project Deadlines Meeting',
            description: 'Discussion about upcoming project milestones and deadlines',
            keywords: ['meeting', 'project', 'deadlines'],
          }),
          originalText: 'This is my important meeting note about project deadlines',
          prompt: 'Generate metadata',
        }),
      } as Response);

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Step 1: Start recording
      const recordButton = screen.getByRole('button', { name: /start recording/i });
      expect(recordButton).toBeInTheDocument();
      
      fireEvent.click(recordButton);

      await waitFor(() => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
      });

      // Step 2: Recording should be active
      expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument();
      expect(screen.getByText(/recording/i)).toBeInTheDocument();

      // Step 3: Stop recording
      const stopButton = screen.getByRole('button', { name: /stop recording/i });
      fireEvent.click(stopButton);

      // Step 4: Simulate recording completion
      const audioBlob = new Blob(['audio data'], { type: 'audio/webm' });
      if (mockMediaRecorder.ondataavailable) {
        mockMediaRecorder.ondataavailable({ data: audioBlob } as any);
      }
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop({} as any);
      }

      // Step 5: Wait for transcription
      await waitFor(() => {
        expect(screen.getByText('This is my important meeting note about project deadlines')).toBeInTheDocument();
      });

      // Step 6: Verify rewrite options appear
      expect(screen.getByRole('button', { name: /rewrite/i })).toBeInTheDocument();

      // Step 7: Note should be saved automatically
      expect(localStorageMock.setItem).toHaveBeenCalled();

      // Step 8: Navigate to notes to verify it was saved
      fireEvent.click(screen.getByRole('button', { name: /history/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/notes');
      });
    });

    it('should handle recording with photo attachment', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // Mock camera API
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn()
            .mockResolvedValueOnce({
              getTracks: () => [{ stop: vi.fn() }],
            })
            .mockResolvedValueOnce({
              getVideoTracks: () => [{ stop: vi.fn() }],
              getTracks: () => [{ stop: vi.fn() }],
            }),
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcript: 'This is a note with a photo attachment',
          language: 'en',
        }),
      } as Response);

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Start recording
      const recordButton = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(recordButton);

      await waitFor(() => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
      });

      // Add photo during recording
      const photoButton = screen.getByRole('button', { name: /add photo/i });
      fireEvent.click(photoButton);

      // Simulate photo capture
      await waitFor(() => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ video: true });
      });

      // Complete recording
      const stopButton = screen.getByRole('button', { name: /stop recording/i });
      fireEvent.click(stopButton);

      const audioBlob = new Blob(['audio data'], { type: 'audio/webm' });
      if (mockMediaRecorder.ondataavailable) {
        mockMediaRecorder.ondataavailable({ data: audioBlob } as any);
      }
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop({} as any);
      }

      // Verify photo was included
      await waitFor(() => {
        expect(screen.getByText('This is a note with a photo attachment')).toBeInTheDocument();
      });

      // Check that photo data was saved
      const saveCall = localStorageMock.setItem.mock.calls.find(
        call => call[0].includes('note-')
      );
      expect(saveCall).toBeDefined();
      const noteData = JSON.parse(saveCall![1]);
      expect(noteData.photoBlob).toBeDefined();
    });
  });

  describe('Settings Configuration Journey', () => {
    it('should allow user to configure API key and preferences', async () => {
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Navigate to settings
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/settings');
      });

      // Mock settings page render
      const { default: SettingsPage } = await import('@/app/settings/page');
      
      render(
        <TestWrapper>
          <SettingsPage />
        </TestWrapper>
      );

      // Configure API key
      const apiKeyInput = screen.getByLabelText(/api key/i);
      fireEvent.change(apiKeyInput, { target: { value: 'sk-new-key-' + 'b'.repeat(40) } });

      // Change default language
      const languageSelect = screen.getByLabelText(/default language/i);
      fireEvent.change(languageSelect, { target: { value: 'es' } });

      // Change theme
      const themeSelect = screen.getByLabelText(/theme/i);
      fireEvent.change(themeSelect, { target: { value: 'dark' } });

      // Save settings
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      // Verify settings were saved
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'openai-api-key',
          expect.stringContaining('sk-new-key-')
        );
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'app-settings',
          expect.stringContaining('"defaultLanguage":"es"')
        );
      });
    });

    it('should manage custom rewrite prompts', async () => {
      const { default: SettingsPage } = await import('@/app/settings/page');
      
      render(
        <TestWrapper>
          <SettingsPage />
        </TestWrapper>
      );

      // Add new rewrite prompt
      const addPromptButton = screen.getByRole('button', { name: /add prompt/i });
      fireEvent.click(addPromptButton);

      const promptNameInput = screen.getByLabelText(/prompt name/i);
      fireEvent.change(promptNameInput, { target: { value: 'Professional Tone' } });

      const promptTextInput = screen.getByLabelText(/prompt text/i);
      fireEvent.change(promptTextInput, { 
        target: { value: 'Rewrite this text in a professional tone' } 
      });

      const savePromptButton = screen.getByRole('button', { name: /save prompt/i });
      fireEvent.click(savePromptButton);

      // Verify prompt was saved
      await waitFor(() => {
        expect(screen.getByText('Professional Tone')).toBeInTheDocument();
      });

      // Delete prompt
      const deletePromptButton = screen.getByRole('button', { name: /delete prompt/i });
      fireEvent.click(deletePromptButton);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.queryByText('Professional Tone')).not.toBeInTheDocument();
      });
    });
  });

  describe('Note Management Journey', () => {
    it('should allow viewing, editing, and sharing notes', async () => {
      // Pre-populate with a test note
      const testNote = {
        id: 'test-note-1',
        title: 'Test Meeting Note',
        description: 'Important meeting about project updates',
        transcript: 'We discussed the project timeline and upcoming milestones',
        rewrittenText: 'Professional summary of project timeline discussion',
        createdAt: new Date().toISOString(),
        duration: 120,
        language: 'en',
        keywords: ['meeting', 'project', 'timeline'],
      };

      localStorageMock.setItem(`note-${testNote.id}`, JSON.stringify(testNote));
      localStorageMock.setItem('notes-list', JSON.stringify([testNote.id]));

      const { default: NotesPage } = await import('@/app/notes/page');
      
      render(
        <TestWrapper>
          <NotesPage />
        </TestWrapper>
      );

      // View note details
      const noteTitle = screen.getByText('Test Meeting Note');
      fireEvent.click(noteTitle);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/notes/test-note-1');
      });

      // Mock note details page
      const { default: NoteDetailsPage } = await import('@/app/notes/[id]/page');
      
      render(
        <TestWrapper>
          <NoteDetailsPage params={{ id: 'test-note-1' }} />
        </TestWrapper>
      );

      // Verify note content is displayed
      expect(screen.getByText('Test Meeting Note')).toBeInTheDocument();
      expect(screen.getByText('We discussed the project timeline and upcoming milestones')).toBeInTheDocument();

      // Edit note
      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      const titleInput = screen.getByDisplayValue('Test Meeting Note');
      fireEvent.change(titleInput, { target: { value: 'Updated Meeting Note' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      // Verify update was saved
      await waitFor(() => {
        expect(screen.getByText('Updated Meeting Note')).toBeInTheDocument();
      });

      // Share note
      const shareButton = screen.getByRole('button', { name: /share/i });
      fireEvent.click(shareButton);

      await waitFor(() => {
        expect(navigator.share).toHaveBeenCalledWith({
          title: 'Updated Meeting Note',
          text: expect.stringContaining('We discussed the project timeline'),
        });
      });

      // Delete note
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      const confirmDeleteButton = screen.getByRole('button', { name: /confirm delete/i });
      fireEvent.click(confirmDeleteButton);

      // Verify note was deleted
      await waitFor(() => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(`note-${testNote.id}`);
      });
    });
  });

  describe('Rewriting and Enhancement Journey', () => {
    it('should allow text rewriting with different prompts', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // Mock transcription
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcript: 'This is a rough transcript that needs improvement',
          language: 'en',
        }),
      } as Response);

      // Mock rewrite responses
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rewrittenText: 'This is a professionally refined transcript with improved clarity',
          originalText: 'This is a rough transcript that needs improvement',
          prompt: 'Make it more professional',
        }),
      } as Response);

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Complete recording
      const recordButton = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(recordButton);

      await waitFor(() => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
      });

      const stopButton = screen.getByRole('button', { name: /stop recording/i });
      fireEvent.click(stopButton);

      const audioBlob = new Blob(['audio data'], { type: 'audio/webm' });
      if (mockMediaRecorder.ondataavailable) {
        mockMediaRecorder.ondataavailable({ data: audioBlob } as any);
      }
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop({} as any);
      }

      // Wait for transcription
      await waitFor(() => {
        expect(screen.getByText('This is a rough transcript that needs improvement')).toBeInTheDocument();
      });

      // Select rewrite prompt
      const promptSelect = screen.getByLabelText(/rewrite prompt/i);
      fireEvent.change(promptSelect, { target: { value: 'professional' } });

      // Trigger rewrite
      const rewriteButton = screen.getByRole('button', { name: /rewrite/i });
      fireEvent.click(rewriteButton);

      // Wait for rewritten text
      await waitFor(() => {
        expect(screen.getByText('This is a professionally refined transcript with improved clarity')).toBeInTheDocument();
      });

      // Verify both original and rewritten text are available
      expect(screen.getByText('This is a rough transcript that needs improvement')).toBeInTheDocument();
      expect(screen.getByText('This is a professionally refined transcript with improved clarity')).toBeInTheDocument();
    });
  });

  describe('Error Recovery Journey', () => {
    it('should handle and recover from API errors', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // First attempt fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          error: 'Service temporarily unavailable',
          type: 'server',
          retryable: true,
        }),
      } as Response);

      // Second attempt succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcript: 'Successfully transcribed after retry',
          language: 'en',
        }),
      } as Response);

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Complete recording
      const recordButton = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(recordButton);

      await waitFor(() => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
      });

      const stopButton = screen.getByRole('button', { name: /stop recording/i });
      fireEvent.click(stopButton);

      const audioBlob = new Blob(['audio data'], { type: 'audio/webm' });
      if (mockMediaRecorder.ondataavailable) {
        mockMediaRecorder.ondataavailable({ data: audioBlob } as any);
      }
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop({} as any);
      }

      // Should show error initially
      await waitFor(() => {
        expect(screen.getByText(/service temporarily unavailable/i)).toBeInTheDocument();
      });

      // Should show retry option
      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      // Should succeed on retry
      await waitFor(() => {
        expect(screen.getByText('Successfully transcribed after retry')).toBeInTheDocument();
      });
    });

    it('should handle storage quota exceeded', async () => {
      // Mock storage quota exceeded
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: vi.fn().mockResolvedValue({
            usage: 990000000, // 990MB
            quota: 1000000000, // 1GB
          }),
        },
      });

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Should show storage warning
      await waitFor(() => {
        expect(screen.getByText(/storage is almost full/i)).toBeInTheDocument();
      });

      // Should provide cleanup options
      expect(screen.getByRole('button', { name: /cleanup/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility Journey', () => {
    it('should support keyboard navigation', async () => {
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Tab through interface
      const recordButton = screen.getByRole('button', { name: /start recording/i });
      recordButton.focus();
      expect(document.activeElement).toBe(recordButton);

      // Use Enter to activate
      fireEvent.keyDown(recordButton, { key: 'Enter' });
      
      await waitFor(() => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
      });

      // Tab to stop button
      fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
      const stopButton = screen.getByRole('button', { name: /stop recording/i });
      expect(document.activeElement).toBe(stopButton);
    });

    it('should provide screen reader support', () => {
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Check ARIA labels
      const recordButton = screen.getByRole('button', { name: /start recording/i });
      expect(recordButton).toHaveAttribute('aria-label');

      // Check live regions for status updates
      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveAttribute('aria-live');
    });
  });
});