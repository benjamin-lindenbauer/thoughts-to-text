import { AppLayout } from "@/components/AppLayout";
import { SettingsForm } from "@/components/SettingsForm";

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="flex">
        <div className="w-full max-w-3xl p-4 md:p-6">
          {/* Header */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-xl md:text-2xl font-bold text-foreground mb-2">
              Settings
            </h1>
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