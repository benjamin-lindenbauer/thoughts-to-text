'use client';

import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Check, X, CircleCheckBig } from 'lucide-react';
import { RewritePrompt } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface RewritePromptManagerProps {
  prompts: RewritePrompt[];
  defaultPromptId: string;
  onAddPrompt: (prompt: Omit<RewritePrompt, 'id'>) => Promise<string>;
  onUpdatePrompt: (id: string, updates: Partial<Omit<RewritePrompt, 'id'>>) => Promise<void>;
  onDeletePrompt: (id: string) => Promise<void>;
  onSetDefault: (promptId: string) => Promise<void>;
}

interface PromptFormData {
  name: string;
  prompt: string;
}

export function RewritePromptManager({
  prompts,
  defaultPromptId,
  onAddPrompt,
  onUpdatePrompt,
  onDeletePrompt,
  onSetDefault,
}: RewritePromptManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<RewritePrompt | null>(null);
  const [formData, setFormData] = useState<PromptFormData>({ name: '', prompt: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({ name: '', prompt: '' });
    setError(null);
    setIsSubmitting(false);
  };

  const handleAddPrompt = async () => {
    if (!formData.name.trim() || !formData.prompt.trim()) {
      setError('Name and prompt are required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      await onAddPrompt({
        name: formData.name.trim(),
        prompt: formData.prompt.trim(),
        isDefault: false,
      });
      
      setIsAddDialogOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add prompt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPrompt = async () => {
    if (!editingPrompt || !formData.name.trim() || !formData.prompt.trim()) {
      setError('Name and prompt are required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      await onUpdatePrompt(editingPrompt.id, {
        name: formData.name.trim(),
        prompt: formData.prompt.trim(),
      });
      
      setEditingPrompt(null);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update prompt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePrompt = async (prompt: RewritePrompt) => {
    if (prompts.length === 1) {
      setError('Cannot delete the last prompt');
      return;
    }
    try {
      await onDeletePrompt(prompt.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete prompt');
    }
  };

  const handleSetDefault = async (promptId: string) => {
    try {
      await onSetDefault(promptId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default prompt');
    }
  };

  const openEditDialog = (prompt: RewritePrompt) => {
    setEditingPrompt(prompt);
    setFormData({ name: prompt.name, prompt: prompt.prompt });
    setError(null);
  };

  const closeEditDialog = () => {
    setEditingPrompt(null);
    resetForm();
  };

  const openAddDialog = () => {
    setIsAddDialogOpen(true);
    resetForm();
  };

  const closeAddDialog = () => {
    setIsAddDialogOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Existing Prompts */}
      <div className="space-y-3">
        {prompts.map((prompt) => (
          <div
            key={prompt.id}
            className={cn(
              'p-4 rounded-xl border transition-all duration-200',
              prompt.id === defaultPromptId
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-border bg-card hover:bg-accent/50'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-foreground truncate">
                    {prompt.name}
                  </span>
                  {prompt.id === defaultPromptId && (
                    <span className="text-xs text-indigo-500 bg-indigo-500/10 px-2 py-1 rounded-full whitespace-nowrap">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {prompt.prompt}
                </p>
              </div>
              
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditDialog(prompt)}
                  className="h-8 w-8 p-0 hover:bg-accent"
                  title="Edit prompt"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>

                {prompt.id !== defaultPromptId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetDefault(prompt.id)}
                    className="h-8 w-8 p-0 hover:bg-accent"
                    title="Set as default prompt"
                  >
                    <CircleCheckBig className="h-4 w-4" />
                  </Button>
                )}
                
                {prompt.id !== defaultPromptId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletePrompt(prompt)}
                    className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                    title="Delete prompt"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add New Prompt Button */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            onClick={openAddDialog}
            className="w-full p-4 h-auto rounded-xl border-dashed hover:bg-accent transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Prompt
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Custom Rewrite Prompt</DialogTitle>
            <DialogDescription>
              Create a custom prompt for rewriting your transcriptions.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Prompt Name
              </label>
              <Input
                placeholder="e.g., Make Professional"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                disabled={isSubmitting}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Prompt Text
              </label>
              <Textarea
                placeholder="Enter the instruction for how to rewrite the text..."
                value={formData.prompt}
                onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                disabled={isSubmitting}
                rows={4}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeAddDialog}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddPrompt}
              disabled={isSubmitting || !formData.name.trim() || !formData.prompt.trim()}
            >
              {isSubmitting ? 'Adding...' : 'Add Prompt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Prompt Dialog */}
      <Dialog open={!!editingPrompt} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Rewrite Prompt</DialogTitle>
            <DialogDescription>
              Modify the custom rewrite prompt.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Prompt Name
              </label>
              <Input
                placeholder="e.g., Make Professional"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                disabled={isSubmitting}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Prompt Text
              </label>
              <Textarea
                placeholder="Enter the instruction for how to rewrite the text..."
                value={formData.prompt}
                onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                disabled={isSubmitting}
                rows={4}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeEditDialog}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditPrompt}
              disabled={
                isSubmitting || 
                !formData.name.trim() || 
                !formData.prompt.trim()
              }
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}