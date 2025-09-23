'use client';

import { AppLayout } from "@/components/AppLayout";
import { useRouter } from 'next/navigation';
import { SettingsForm } from "@/components/SettingsForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Coffee } from "lucide-react";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const router = useRouter();

  return (
    <AppLayout
      header={
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => router.push('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-lg md:text-xl font-bold text-foreground">
              Settings
            </h1>
          </div>
          <OfflineIndicator />
        </div>
      }
    >
      <div className="flex flex-col w-full">
        {/* Settings Form */}
        <div className="flex-1 min-h-0 py-4 md:py-8">
          <SettingsForm />
        </div>
        {/* Support Banner */}
        <div className="pt-2">
          <a
            href="https://buymeacoffee.com/qrewa8p8qz"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'btn-gradient-primary',
              'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium'
            )}
          >
            <span>If you like the app, buy me a coffee</span>
            <Coffee className="w-4 h-4" />
          </a>
        </div>
        <div className="py-4 text-center text-xs text-muted-foreground">
          &copy; 2025 ben_zen, All Rights Reserved. Built by{' '}
          <a
            href="https://www.benzen.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            ben_zen
          </a>
        </div>
      </div>
    </AppLayout>
  );
}