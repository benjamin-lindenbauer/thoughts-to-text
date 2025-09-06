import { AppLayout } from "@/components/AppLayout";
import { SettingsForm } from "@/components/SettingsForm";

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="flex justify-center">
        <div className="w-full max-w-3xl">
          <SettingsForm />
        </div>
      </div>
    </AppLayout>
  );
}