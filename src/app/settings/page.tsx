'use client';

import { AppLayout } from "@/components/AppLayout";
import { useRouter } from 'next/navigation';
import { SettingsForm } from "@/components/SettingsForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();

  return (
    <AppLayout>
      <div className="flex">
        <div className="w-full max-w-3xl p-4 md:p-6">
          {/* Header */}
          <div className="mb-6 md:mb-8">
            <div className="flex flex-row gap-2">
              <Button
                variant="ghost"
                onClick={() => router.back()}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <h1 className="text-xl md:text-2xl font-bold text-foreground mb-2">
                Settings
              </h1>
            </div>
            <p className="text-sm md:text-base text-muted-foreground">
              Configure your recording and transcription preferences
            </p>
          </div>

          <SettingsForm />
        </div>
      </div>
    </AppLayout>
  );
}