"use client";

import React from "react";
import { RefreshCw, Wand2 } from "lucide-react";
import { cn, LANGUAGE_OPTIONS } from "@/lib/utils";
import type { RewritePrompt } from "@/types";

export interface RewriteControlsProps {
  className?: string;
  rewritePrompts: RewritePrompt[];
  selectedPrompt: string;
  onChangePrompt: (id: string) => void;
  selectedLanguage: string;
  onChangeLanguage: (code: string) => void;
  isRewriting: boolean;
  transcript: string | null;
  onRewrite: () => void;
  disabled?: boolean;
}

export function RewriteControls({
  className,
  rewritePrompts,
  selectedPrompt,
  onChangePrompt,
  selectedLanguage,
  onChangeLanguage,
  isRewriting,
  transcript,
  onRewrite,
  disabled = false,
}: RewriteControlsProps) {
  const isDisabled =
    disabled ||
    isRewriting ||
    transcript === null ||
    (typeof transcript === "string" && transcript.trim().length === 0);

  return (
    <div className={cn("flex flex-col md:flex-row gap-2", className)}>
      <select
        value={selectedPrompt}
        onChange={(e) => onChangePrompt(e.target.value)}
        disabled={isRewriting || disabled}
        className="w-full md:w-1/3 p-2 rounded-lg border border-border bg-background text-foreground text-sm transition-colors focus:border-transparent disabled:opacity-50"
      >
        {rewritePrompts.map((prompt) => (
          <option key={prompt.id} value={prompt.id}>
            {prompt.name}
          </option>
        ))}
      </select>

      {/* Language selection */}
      <select
        value={selectedLanguage}
        disabled={isRewriting || disabled}
        onChange={(e) => onChangeLanguage(e.target.value)}
        className="w-full md:w-1/3 p-2 rounded-lg border border-border bg-background text-foreground text-sm transition-colors focus:border-transparent disabled:opacity-50"
      >
        {LANGUAGE_OPTIONS.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name} {lang.nativeName ? `(${lang.nativeName})` : ""}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onRewrite}
        disabled={isDisabled}
        className={cn(
          "w-full md:w-1/3 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium",
          "btn-gradient-primary"
        )}
      >
        {isRewriting ? (
          <>
            <RefreshCw className="size-4 animate-spin" />
            <span>Rewriting...</span>
          </>
        ) : (
          <>
            <Wand2 className="size-4" />
            <span>Rewrite</span>
          </>
        )}
      </button>
    </div>
  );
}
