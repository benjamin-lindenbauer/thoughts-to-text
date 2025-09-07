import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import NotesList from '@/components/NotesList';
import MobileNavigation from '@/components/MobileNavigation';
import OfflineIndicator from '@/components/OfflineIndicator';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import StorageQuotaWarning from '@/components/StorageQuotaWarning';
import ErrorBoundary from '@/components/ErrorBoundary';

// Mock router
const mockPush = vi.fn();
const mockPathname = '/';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    pathname: mockPathname,
  }),
  usePathname: () => mockPathname,
}));

// Mock hooks
vi.mock('@/hooks/useNotes', () => ({
  useNotes: () => ({
    notes: [
      {
        id: '1',
        title: 'Test Note 1',
        description: 'First test note',
        transcript: 'This is the first test transcript',
        createdAt: new Date('2024-01-01'),
        duration: 30,
        language: 'en',
      },
      {
        id: '2',
        title: 'Test Note 2',
        description: 'Second test note',
        transcript: 'This is the second test transcript',
        createdAt: new Date('2024-01-02'),
        duration: 45,
        language: 'en',
      },
    ],
    loading: false,
    error: null,
    deleteNote: vi.fn(),
    updateNote: vi.fn(),
  }),
}));

vi.mock('@/hooks/useOffline', () => ({
  useOffline: () => ({
    isOffline: false,
    isOnline: true,
  }),
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <AppProvider>
      {children}
    </AppProvider>
  </ThemeProvider>
);

describe('Major UI Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('NotesList', () => {
    it('should render list of notes', () => {
      render(
        <TestWrapper>
          <NotesList />
        </TestWrapper>
      );

      expect(screen.getByText('Test Note 1')).toBeInTheDocument();
      expect(screen.getByText('Test Note 2')).toBeInTheDocument();
      expect(screen.getByText('First test note')).toBeInTheDocument();
      expect(screen.getByText('Second test note')).toBeInTheDocument();
    });

    it('should handle note selection', async () => {
      render(
        <TestWrapper>
          <NotesList />
        </TestWrapper>
      );

      const firstNote = screen.getByText('Test Note 1');
      fireEvent.click(firstNote);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/notes/1');
      });
    });

    it('should show empty state when no notes', () => {
      // Mock empty notes
      vi.mocked(require('@/hooks/useNotes').useNotes).mockReturnValueOnce({
        notes: [],
        loading: false,
        error: null,
        deleteNote: vi.fn(),
        updateNote: vi.fn(),
      });

      render(
        <TestWrapper>
          <NotesList />
        </TestWrapper>
      );

      expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
    });

    it('should show loading state', () => {
      // Mock loading state
      vi.mocked(require('@/hooks/useNotes').useNotes).mockReturnValueOnce({
        notes: [],
        loading: true,
        error: null,
        deleteNote: vi.fn(),
        updateNote: vi.fn(),
      });

      render(
        <TestWrapper>
          <NotesList />
        </TestWrapper>
      );

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should handle delete action', async () => {
      const mockDeleteNote = vi.fn();
      vi.mocked(require('@/hooks/useNotes').useNotes).mockReturnValueOnce({
        notes: [
          {
            id: '1',
            title: 'Test Note 1',
            description: 'First test note',
            transcript: 'This is the first test transcript',
            createdAt: new Date('2024-01-01'),
            duration: 30,
            language: 'en',
          },
        ],
        loading: false,
        error: null,
        deleteNote: mockDeleteNote,
        updateNote: vi.fn(),
      });

      render(
        <TestWrapper>
          <NotesList />
        </TestWrapper>
      );

      // Find and click delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockDeleteNote).toHaveBeenCalledWith('1');
      });
    });
  });

  describe('MobileNavigation', () => {
    it('should render navigation buttons', () => {
      render(
        <TestWrapper>
          <MobileNavigation />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /history/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /record/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
    });

    it('should navigate to correct pages', async () => {
      render(
        <TestWrapper>
          <MobileNavigation />
        </TestWrapper>
      );

      const historyButton = screen.getByRole('button', { name: /history/i });
      fireEvent.click(historyButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/notes');
      });

      const recordButton = screen.getByRole('button', { name: /record/i });
      fireEvent.click(recordButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/settings');
      });
    });

    it('should highlight active page', () => {
      // Mock current pathname
      vi.mocked(require('next/navigation').usePathname).mockReturnValue('/notes');

      render(
        <TestWrapper>
          <MobileNavigation />
        </TestWrapper>
      );

      const historyButton = screen.getByRole('button', { name: /history/i });
      expect(historyButton).toHaveClass('bg-indigo-500'); // Active state styling
    });
  });

  describe('OfflineIndicator', () => {
    it('should not show when online', () => {
      render(
        <TestWrapper>
          <OfflineIndicator />
        </TestWrapper>
      );

      expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
    });

    it('should show when offline', () => {
      // Mock offline state
      vi.mocked(require('@/hooks/useOffline').useOffline).mockReturnValue({
        isOffline: true,
        isOnline: false,
      });

      render(
        <TestWrapper>
          <OfflineIndicator />
        </TestWrapper>
      );

      expect(screen.getByText(/offline/i)).toBeInTheDocument();
    });

    it('should show sync status when coming back online', () => {
      // Mock syncing state
      vi.mocked(require('@/hooks/useOffline').useOffline).mockReturnValue({
        isOffline: false,
        isOnline: true,
        isSyncing: true,
      });

      render(
        <TestWrapper>
          <OfflineIndicator />
        </TestWrapper>
      );

      expect(screen.getByText(/syncing/i)).toBeInTheDocument();
    });
  });

  describe('PWAInstallPrompt', () => {
    it('should show install prompt when available', () => {
      // Mock beforeinstallprompt event
      const mockPromptEvent = {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };

      render(
        <TestWrapper>
          <PWAInstallPrompt />
        </TestWrapper>
      );

      // Simulate beforeinstallprompt event
      fireEvent(window, new CustomEvent('beforeinstallprompt', {
        detail: mockPromptEvent,
      }));

      expect(screen.getByText(/install app/i)).toBeInTheDocument();
    });

    it('should handle install action', async () => {
      const mockPromptEvent = {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };

      render(
        <TestWrapper>
          <PWAInstallPrompt />
        </TestWrapper>
      );

      // Simulate beforeinstallprompt event
      fireEvent(window, new CustomEvent('beforeinstallprompt', {
        detail: mockPromptEvent,
      }));

      const installButton = screen.getByRole('button', { name: /install/i });
      fireEvent.click(installButton);

      await waitFor(() => {
        expect(mockPromptEvent.prompt).toHaveBeenCalled();
      });
    });

    it('should hide after installation', async () => {
      const mockPromptEvent = {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };

      render(
        <TestWrapper>
          <PWAInstallPrompt />
        </TestWrapper>
      );

      // Simulate beforeinstallprompt event
      fireEvent(window, new CustomEvent('beforeinstallprompt', {
        detail: mockPromptEvent,
      }));

      expect(screen.getByText(/install app/i)).toBeInTheDocument();

      // Simulate appinstalled event
      fireEvent(window, new Event('appinstalled'));

      await waitFor(() => {
        expect(screen.queryByText(/install app/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('StorageQuotaWarning', () => {
    it('should show warning when storage is near limit', () => {
      // Mock storage quota hook
      vi.mock('@/hooks/useStorage', () => ({
        useStorageQuota: () => ({
          quota: { percentage: 85, used: 850000000, available: 1000000000 },
          isNearLimit: true,
          isAtLimit: false,
          recommendedAction: 'warn',
        }),
      }));

      render(
        <TestWrapper>
          <StorageQuotaWarning />
        </TestWrapper>
      );

      expect(screen.getByText(/storage is getting full/i)).toBeInTheDocument();
      expect(screen.getByText(/85%/)).toBeInTheDocument();
    });

    it('should show critical warning when at limit', () => {
      vi.mocked(require('@/hooks/useStorage').useStorageQuota).mockReturnValue({
        quota: { percentage: 95, used: 950000000, available: 1000000000 },
        isNearLimit: true,
        isAtLimit: true,
        recommendedAction: 'cleanup',
      });

      render(
        <TestWrapper>
          <StorageQuotaWarning />
        </TestWrapper>
      );

      expect(screen.getByText(/storage is almost full/i)).toBeInTheDocument();
      expect(screen.getByText(/cleanup/i)).toBeInTheDocument();
    });

    it('should not show when storage is fine', () => {
      vi.mocked(require('@/hooks/useStorage').useStorageQuota).mockReturnValue({
        quota: { percentage: 50, used: 500000000, available: 1000000000 },
        isNearLimit: false,
        isAtLimit: false,
        recommendedAction: 'none',
      });

      render(
        <TestWrapper>
          <StorageQuotaWarning />
        </TestWrapper>
      );

      expect(screen.queryByText(/storage/i)).not.toBeInTheDocument();
    });
  });

  describe('ErrorBoundary', () => {
    // Suppress console.error for these tests
    const originalError = console.error;
    beforeEach(() => {
      console.error = vi.fn();
    });

    afterEach(() => {
      console.error = originalError;
    });

    it('should catch and display errors', () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      expect(screen.getByText(/test error/i)).toBeInTheDocument();
    });

    it('should provide error recovery options', () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
    });

    it('should handle retry action', () => {
      let shouldThrow = true;
      const ConditionalError = () => {
        if (shouldThrow) {
          throw new Error('Test error');
        }
        return <div>Success</div>;
      };

      render(
        <ErrorBoundary>
          <ConditionalError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

      // Fix the error condition
      shouldThrow = false;

      const retryButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(retryButton);

      expect(screen.getByText('Success')).toBeInTheDocument();
    });
  });
});