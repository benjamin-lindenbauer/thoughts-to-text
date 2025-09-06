import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SettingsForm } from '../SettingsForm';
import { ThemeProvider } from '@/contexts/ThemeContext';
import * as storageModule from '@/lib/storage';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock the storage module
vi.mock('@/lib/storage', () => ({
  storeSettings: vi.fn(),
  retrieveSettings: vi.fn(),
  storeApiKey: vi.fn(),
  retrieveApiKey: vi.fn(),
  clearApiKey: vi.fn(),
}));

// Mock the theme context
const mockSetTheme = vi.fn();
vi.mock('@/contexts/ThemeContext', async () => {
  const actual = await vi.importActual('@/contexts/ThemeContext');
  return {
    ...actual,
    useTheme: () => ({
      theme: 'auto',
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
    }),
  };
});

// Wrapper component with theme provider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('SettingsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock default settings retrieval
    vi.mocked(storageModule.retrieveSettings).mockResolvedValue({
      openaiApiKey: '',
      defaultLanguage: 'en',
      theme: 'auto',
      rewritePrompts: [
        {
          id: 'default',
          name: 'Default',
          prompt: 'Improve the clarity and grammar of the following text while maintaining the original meaning and tone.',
          isDefault: true,
        },
      ],
      defaultRewritePrompt: 'default',
    });
    
    vi.mocked(storageModule.retrieveApiKey).mockResolvedValue(null);
  });

  it('renders settings form with all sections', async () => {
    render(<SettingsForm />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // Check for main sections
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('API Configuration')).toBeInTheDocument();
    expect(screen.getByText('Language Settings')).toBeInTheDocument();
    expect(screen.getByText('Rewrite Prompts')).toBeInTheDocument();
  });

  it('validates API key input', async () => {
    render(<SettingsForm />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument();
    });

    const apiKeyInput = screen.getByPlaceholderText('sk-...');
    
    // Test invalid API key
    fireEvent.change(apiKeyInput, { target: { value: 'invalid-key' } });
    await waitFor(() => {
      expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument(); // Alert icon
    });

    // Test valid API key format
    fireEvent.change(apiKeyInput, { target: { value: 'sk-1234567890abcdef1234567890abcdef' } });
    await waitFor(() => {
      expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument(); // Check icon
    });
  });

  it('saves API key when save button is clicked', async () => {
    render(<SettingsForm />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument();
    });

    const apiKeyInput = screen.getByPlaceholderText('sk-...');
    const saveButton = screen.getByText('Save');

    // Enter valid API key
    fireEvent.change(apiKeyInput, { target: { value: 'sk-1234567890abcdef1234567890abcdef' } });
    
    // Click save
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(storageModule.storeSettings).toHaveBeenCalled();
    });
  });

  it('shows default rewrite prompts', async () => {
    render(<SettingsForm />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Default')).toBeInTheDocument();
    });

    // Check for default prompt
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText('Add Custom Prompt')).toBeInTheDocument();
  });

  it('handles language selection', async () => {
    render(<SettingsForm />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Default Language for Transcription')).toBeInTheDocument();
    });

    // The select component should be present
    const selectTrigger = screen.getByRole('combobox');
    expect(selectTrigger).toBeInTheDocument();
  });

  it('displays loading state initially', () => {
    // Mock loading state
    vi.mocked(storageModule.retrieveSettings).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<SettingsForm />, { wrapper: TestWrapper });

    // Should show loading skeleton
    expect(screen.getByRole('generic')).toHaveClass('animate-pulse');
  });

  it('displays error state when settings fail to load', async () => {
    vi.mocked(storageModule.retrieveSettings).mockRejectedValue(
      new Error('Failed to load settings')
    );

    render(<SettingsForm />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText(/Failed to load settings/)).toBeInTheDocument();
    });
  });
});