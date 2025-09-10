"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  text: string;
  title?: string;
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "ghost" | "default" | "outline" | "secondary" | "destructive" | "link";
  iconClassName?: string;
}

export function CopyButton({
  text,
  title = "Copy to clipboard",
  className,
  size = "sm",
  variant = "ghost",
  iconClassName,
}: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(text || "");
      setIsCopied(true);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => setIsCopied(false), 2000);
    } catch (e) {
      // Intentionally no success toast; failures can be handled by caller if needed
      // For consistency, silently fail to avoid noisy UI
      console.error("Copy failed", e);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      title={title}
      aria-label={title}
      className={cn("h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full", className)}
    >
      {isCopied ? (
        <Check className={cn("h-4 w-4 text-green-500", iconClassName)} />
      ) : (
        <Copy className={cn("h-4 w-4 text-gray-500 dark:text-gray-400", iconClassName)} />
      )}
    </Button>
  );
}
