'use client';

import React, { useState, useEffect } from 'react';
import { Key, Globe, MessageSquare, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';
import { useTheme } from '@/contexts/ThemeContext';
import { DEFAULT_REWRITE_PROMPTS, LANGUAGE_OPTIONS } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ThemeToggle } from '@/components/ThemeToggle';
import { RewritePromptManager } from '@/components/RewritePromptManager';
import { PWAInstallButton } from '@/components/PWAInstallPrompt';
import { cn } from '@/lib/utils';

export function SettingsForm() {
  const { settings, ui, state } = useAppState();
  const isLoading = !state?.isSettingsLoaded;
  const settingsError = ui?.error;

  const { setTheme } = useTheme();

  // Validation helpers
  const validateApiKey = (apiKey: string): boolean => {
    return apiKey.startsWith('sk-') && apiKey.length > 20;
  };

  // Update functions
  const updateApiKey = async (apiKey: string) => {
    await settings.updateSettings({ openaiApiKey: apiKey });
  };

  const updateDefaultLanguage = async (language: string) => {
    await settings.updateSettings({ defaultLanguage: language });
  };

  const updateTheme = async (theme: 'light' | 'dark' | 'auto') => {
    await settings.updateSettings({ theme });
  };

  const addRewritePrompt = async (prompt: { name: string; prompt: string; isDefault: boolean }) => {
    if (!settings?.settings?.rewritePrompts) return '';
    const newPrompt = {
      ...prompt,
      id: crypto.randomUUID(),
    };
    const updatedPrompts = [...settings.settings.rewritePrompts, newPrompt];
    await settings.updateSettings({ rewritePrompts: updatedPrompts });
    return newPrompt.id;
  };

  const updateRewritePrompt = async (id: string, updates: Partial<{ name: string; prompt: string; isDefault: boolean }>) => {
    if (!settings?.settings?.rewritePrompts) return;
    const updatedPrompts = settings.settings.rewritePrompts.map(prompt =>
      prompt.id === id ? { ...prompt, ...updates } : prompt
    );
    await settings.updateSettings({ rewritePrompts: updatedPrompts });
  };

  const deleteRewritePrompt = async (id: string) => {
    if (!settings?.settings?.rewritePrompts) return;
    const updatedPrompts = settings.settings.rewritePrompts.filter(prompt => prompt.id !== id);
    let newDefaultPrompt = settings.settings.defaultRewritePrompt;
    if (settings.settings.defaultRewritePrompt === id && updatedPrompts.length > 0) {
      newDefaultPrompt = updatedPrompts[0].id;
    }
    await settings.updateSettings({ 
      rewritePrompts: updatedPrompts,
      defaultRewritePrompt: newDefaultPrompt
    });
  };

  const setDefaultRewritePrompt = async (promptId: string) => {
    if (!settings?.settings?.rewritePrompts) return;
    const updatedPrompts = settings.settings.rewritePrompts.map(prompt => ({
      ...prompt,
      isDefault: prompt.id === promptId,
    }));
    await settings.updateSettings({
      rewritePrompts: updatedPrompts,
      defaultRewritePrompt: promptId,
    });
  };

  // Local form state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize form with current settings
  useEffect(() => {
    if (settings?.settings?.openaiApiKey) {
      setApiKeyInput(settings.settings.openaiApiKey);
      setApiKeyStatus(validateApiKey(settings.settings.openaiApiKey) ? 'valid' : 'invalid');
    }
  }, [settings?.settings?.openaiApiKey]);

  // Handle API key changes
  const handleApiKeyChange = (value: string) => {
    setApiKeyInput(value);
    setFormError(null);
    setSaveStatus(null);
    
    if (value.trim()) {
      setApiKeyStatus(validateApiKey(value) ? 'valid' : 'invalid');
    } else {
      setApiKeyStatus('idle');
    }
  };

  // Save API key
  const handleSaveApiKey = async () => {
    try {
      setIsSaving(true);
      setFormError(null);
      
      await updateApiKey(apiKeyInput.trim());
      setSaveStatus('API key saved successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save API key');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle language change
  const handleLanguageChange = async (language: string) => {
    try {
      setFormError(null);
      await updateDefaultLanguage(language);
      setSaveStatus('Default language updated');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update language');
    }
  };

  // Handle theme change (sync with theme context)
  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'auto') => {
    try {
      setFormError(null);
      await updateTheme(newTheme);
      setTheme(newTheme); // Update theme context immediately
      setSaveStatus('Theme preference updated');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update theme');
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>

      {/* Global Error Display */}
      {(settingsError || formError) && (
        <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">{settingsError || formError}</span>
          </div>
        </div>
      )}

      {/* Success Status */}
      {saveStatus && (
        <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">{saveStatus}</span>
          </div>
        </div>
      )}

      {/* Settings Sections */}
      <div className="space-y-6 my-2 md:my-4 max-w-3xl">
        {/* Theme Settings */}
        <div className="space-y-4">
          <ThemeToggle />
        </div>

        {/* API Configuration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-foreground">
              API Configuration
            </h2>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
            <label className="block text-sm font-medium text-foreground">
              OpenAI API Key
            </label>
            <div className="flex items-center gap-1">
              {apiKeyStatus === 'valid' && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              {apiKeyStatus === 'invalid' && (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
            </div>
            </div>            
            <div className="space-y-2">
              <div className="flex flex-row items-center gap-2">
                <Input
                  type={apiKeyVisible ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={apiKeyInput}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  className={cn(
                    apiKeyStatus === 'invalid' && 'border-destructive focus:ring-destructive'
                  )}
                />
                <Button
                  onClick={handleSaveApiKey}
                  disabled={isSaving || !apiKeyInput.trim() || apiKeyInput === settings?.settings?.openaiApiKey}
                  size="sm"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Your API key is stored locally and never sent to our servers
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Language Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-foreground">
              Language Settings
            </h2>
          </div>
          
          <div className="space-y-3">
            <label className="block text-sm font-medium text-foreground">
              Default Language for Transcription
            </label>
            
            <Select
              value={settings?.settings?.defaultLanguage || 'en'}
              onValueChange={handleLanguageChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select default language" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((language) => (
                  <SelectItem key={language.code} value={language.code}>
                    {language.nativeName} ({language.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <p className="text-xs text-muted-foreground">
              This language will be pre-selected when recording new voice memos
            </p>
          </div>
        </div>

        {/* Rewrite Prompts */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-foreground">
              Rewrite Prompts
            </h2>
          </div>
          
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Manage prompts used to enhance your transcriptions with AI
            </p>
            
            <RewritePromptManager
              prompts={settings?.settings?.rewritePrompts || []}
              defaultPromptId={settings?.settings?.defaultRewritePrompt || 'default'}
              onAddPrompt={addRewritePrompt}
              onUpdatePrompt={updateRewritePrompt}
              onDeletePrompt={deleteRewritePrompt}
              onSetDefault={setDefaultRewritePrompt}
              defaultPromptIds={DEFAULT_REWRITE_PROMPTS.map(p => p.id)}
            />
          </div>
        </div>

        {/* PWA Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-foreground">
              App Installation
            </h2>
          </div>
          
          <div className="space-y-3">
            <PWAInstallButton className="w-full justify-center" />
            <p className="text-xs text-muted-foreground">
              Install the app for offline access and a native app experience
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}