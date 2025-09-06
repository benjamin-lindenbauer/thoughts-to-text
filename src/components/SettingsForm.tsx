'use client';

import React, { useState, useEffect } from 'react';
import { Key, Globe, MessageSquare, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/contexts/ThemeContext';
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
  const {
    settings,
    isLoading,
    error: settingsError,
    updateApiKey,
    updateDefaultLanguage,
    updateTheme,
    addRewritePrompt,
    updateRewritePrompt,
    deleteRewritePrompt,
    setDefaultRewritePrompt,
    validateApiKey,
    getLanguageDisplayName,
    languageOptions,
    defaultRewritePrompts,
  } = useSettings();

  const { setTheme } = useTheme();

  // Local form state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize form with current settings
  useEffect(() => {
    if (settings.openaiApiKey) {
      setApiKeyInput(settings.openaiApiKey);
      setApiKeyStatus(validateApiKey(settings.openaiApiKey) ? 'valid' : 'invalid');
    }
  }, [settings.openaiApiKey, validateApiKey]);

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
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-foreground mb-2">
          Settings
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Configure your preferences and API settings
        </p>
      </div>

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
      <div className="space-y-6 md:space-y-8 max-w-2xl">
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
            <label className="block text-sm font-medium text-foreground">
              OpenAI API Key
            </label>
            
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={apiKeyVisible ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={apiKeyInput}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  className={cn(
                    'pr-20',
                    apiKeyStatus === 'valid' && 'border-green-500 focus:ring-green-500',
                    apiKeyStatus === 'invalid' && 'border-destructive focus:ring-destructive'
                  )}
                />
                
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {apiKeyStatus === 'valid' && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {apiKeyStatus === 'invalid' && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setApiKeyVisible(!apiKeyVisible)}
                    className="h-6 w-6 p-0 hover:bg-transparent"
                  >
                    {apiKeyVisible ? '🙈' : '👁️'}
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Your API key is stored locally and never sent to our servers
                </p>
                
                <Button
                  onClick={handleSaveApiKey}
                  disabled={isSaving || !apiKeyInput.trim() || apiKeyInput === settings.openaiApiKey}
                  size="sm"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
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
              value={settings.defaultLanguage}
              onValueChange={handleLanguageChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select default language" />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((language) => (
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
              prompts={settings.rewritePrompts}
              defaultPromptId={settings.defaultRewritePrompt}
              onAddPrompt={addRewritePrompt}
              onUpdatePrompt={updateRewritePrompt}
              onDeletePrompt={deleteRewritePrompt}
              onSetDefault={setDefaultRewritePrompt}
              defaultPromptIds={defaultRewritePrompts.map(p => p.id)}
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