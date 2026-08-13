import { PageHeader } from "@/components/admin/page-header";
import { getAppSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getAppSettings();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Defaults applied across the bot and the back office."
      />
      <SettingsForm settings={settings} />
    </div>
  );
}
