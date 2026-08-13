"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/admin/action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateAppSettingsAction } from "@/lib/actions/settings";
import type { AppSettings } from "@/lib/settings";

const LANGUAGES: Record<string, string> = {
  en: "English",
  fr: "Français",
};

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [quota, setQuota] = useState(String(settings.defaultQuotaPerMonth));
  const [window, setWindow] = useState(String(settings.aggregationWindowMinutes));
  const [language, setLanguage] = useState(settings.language);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(): void {
    setError(null);
    startTransition(async () => {
      const result = await updateAppSettingsAction({
        defaultQuotaPerMonth: Number(quota),
        aggregationWindowMinutes: Number(window),
        language,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success("Saved");
    });
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="default-quota">Default quota per month</Label>
        <Input
          id="default-quota"
          type="number"
          min={0}
          max={1000}
          inputMode="numeric"
          className="w-32 font-data"
          value={quota}
          onChange={(event) => setQuota(event.target.value)}
        />
        <span className="text-xs text-muted-foreground">
          Given to every new guest. 0 means unlimited. Changing it does not touch
          people who already have a quota.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="aggregation-window">Notification window</Label>
        <div className="flex items-center gap-2">
          <Input
            id="aggregation-window"
            type="number"
            min={1}
            max={120}
            inputMode="numeric"
            className="w-32 font-data"
            value={window}
            onChange={(event) => setWindow(event.target.value)}
          />
          <span className="text-sm text-muted-foreground">minutes</span>
        </div>
        <span className="text-xs text-muted-foreground">
          Season imports arrive episode by episode. Askarr holds them for this
          long and sends one message instead of twenty.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="language">Language</Label>
        <Select
          items={LANGUAGES}
          value={language}
          onValueChange={(value) => {
            if (value) setLanguage(value);
          }}
        >
          <SelectTrigger id="language" className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(LANGUAGES).map(([code, label]) => (
              <SelectItem key={code} value={code}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          The language the bot replies in.
        </span>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div>
        <ActionButton type="submit" disabled={pending}>
          Save settings
        </ActionButton>
      </div>
    </form>
  );
}
