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
  size = "default",
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

  const iconSizeClass = size === "sm" ? "size-3" : size === "lg" ? "size-5" : "size-4";
  const squareSizeClass = size === "sm" ? "!size-8" : size === "lg" ? "!size-10" : "!size-9";

  return (
    <Button
      variant={variant}
      size={"icon"}
      onClick={handleClick}
      title={title}
      aria-label={title}
      className={cn(
        "hover:bg-gray-100 dark:hover:bg-gray-700 aspect-square rounded-lg",
        squareSizeClass,
        className
      )}
    >
      {isCopied ? (
        <Check className={cn(iconSizeClass, "text-green-500", iconClassName)} />
      ) : (
        <Copy className={cn(iconSizeClass, "text-gray-500 dark:text-gray-400", iconClassName)} />
      )}
    </Button>
  );
}
