'use client';

import { AppLayout } from "@/components/AppLayout";
import { useRouter } from 'next/navigation';
import { SettingsForm } from "@/components/SettingsForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();

  return (
    <AppLayout
      header={
        <div className="flex items-center gap-2 w-full">
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
      }
    >
      <div className="flex flex-col w-full">
        {/* Settings Form */}
        <div className="flex-1 min-h-0">
          <SettingsForm />
        </div>
      </div>
    </AppLayout>
  );
}