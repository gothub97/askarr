"use client";

import { ArrKind, AudioVersion } from "@prisma/client";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/admin/action-button";
import { Data } from "@/components/admin/data";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  createInstanceAction,
  getInstanceSecretAction,
  testInstanceConnectionAction,
  updateInstanceAction,
} from "@/lib/actions/instances";
import type { PublicInstance, TestConnectionResult } from "@/lib/instances";

type Probe = Extract<TestConnectionResult, { ok: true }>;

const KIND_LABELS: Record<ArrKind, string> = {
  RADARR: "Radarr · movies",
  SONARR: "Sonarr · series",
};

const VERSION_LABELS: Record<AudioVersion, string> = {
  VO: "VO · original audio",
  MULTI: "MULTI · French audio track",
};

interface FormState {
  label: string;
  kind: ArrKind;
  version: AudioVersion;
  baseUrl: string;
  apiKey: string;
  qualityProfileId: number | null;
  rootFolderPath: string;
  allowSelfSigned: boolean;
  enabled: boolean;
  isDefault: boolean;
}

function initialState(instance: PublicInstance | null): FormState {
  return {
    label: instance?.label ?? "",
    kind: instance?.kind ?? ArrKind.RADARR,
    version: instance?.version ?? AudioVersion.MULTI,
    baseUrl: instance?.baseUrl ?? "",
    // Never prefilled: the real key is fetched only when explicitly asked for.
    apiKey: "",
    qualityProfileId: instance?.qualityProfileId ?? null,
    rootFolderPath: instance?.rootFolderPath ?? "",
    allowSelfSigned: instance?.allowSelfSigned ?? false,
    enabled: instance?.enabled ?? true,
    isDefault: instance?.isDefault ?? false,
  };
}

export function InstanceForm({
  open,
  instance,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  instance: PublicInstance | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialState(instance));
  const [probe, setProbe] = useState<Probe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, startTesting] = useTransition();
  const [saving, startSaving] = useTransition();
  const [loadingKey, startLoadingKey] = useTransition();

  const editing = instance !== null;

  // Reopening the dialog on another instance must not inherit the previous
  // probe: profiles and folders belong to one instance only.
  useEffect(() => {
    if (!open) return;
    setForm(initialState(instance));
    setProbe(null);
    setError(null);
  }, [open, instance]);

  function patch(next: Partial<FormState>): void {
    setForm((current) => ({ ...current, ...next }));
  }

  function test(): void {
    setError(null);
    startTesting(async () => {
      const result = await testInstanceConnectionAction({
        label: form.label || "this instance",
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        allowSelfSigned: form.allowSelfSigned,
      });

      if (!result.ok) {
        setProbe(null);
        setError(result.message);
        return;
      }

      setProbe(result);
      toast.success(`Connected · ${result.appName ?? "instance"} v${result.version}`);

      // Keep the saved choices when the instance still offers them.
      const keepProfile = result.qualityProfiles.some(
        (profile) => profile.id === form.qualityProfileId,
      );
      const keepFolder = result.rootFolders.some(
        (folder) => folder.path === form.rootFolderPath,
      );
      patch({
        qualityProfileId: keepProfile
          ? form.qualityProfileId
          : (result.qualityProfiles[0]?.id ?? null),
        rootFolderPath: keepFolder
          ? form.rootFolderPath
          : (result.rootFolders[0]?.path ?? ""),
      });
    });
  }

  function loadSavedKey(): void {
    if (!instance) return;
    startLoadingKey(async () => {
      const result = await getInstanceSecretAction(instance.id);
      if (!result.ok) {
        setError("Could not read the saved key. Paste it again.");
        return;
      }
      patch({ apiKey: result.apiKey });
    });
  }

  function save(): void {
    setError(null);
    startSaving(async () => {
      const payload = {
        label: form.label,
        kind: form.kind,
        version: form.version,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        qualityProfileId: form.qualityProfileId ?? 0,
        rootFolderPath: form.rootFolderPath,
        tagIds: instance?.tagIds ?? [],
        allowSelfSigned: form.allowSelfSigned,
        enabled: form.enabled,
        isDefault: form.isDefault,
      };

      const result = instance
        ? await updateInstanceAction(instance.id, payload)
        : await createInstanceAction(payload);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      toast.success(editing ? "Saved" : "Added", { description: form.label });
      onOpenChange(false);
      onSaved();
    });
  }

  const canSave =
    form.label.trim().length > 0 &&
    form.baseUrl.trim().length > 0 &&
    form.apiKey.length > 0 &&
    form.qualityProfileId !== null &&
    form.rootFolderPath.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit instance" : "Add instance"}</DialogTitle>
          <DialogDescription>
            Test the connection first: quality profiles and root folders are read
            from the instance, never typed by hand.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field id="instance-label" label="Name">
            <Input
              id="instance-label"
              value={form.label}
              placeholder="Radarr MULTI"
              onChange={(event) => patch({ label: event.target.value })}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="instance-kind" label="Kind">
              <Select
                items={KIND_LABELS}
                value={form.kind}
                onValueChange={(value) => {
                  if (value) patch({ kind: value as ArrKind });
                }}
              >
                <SelectTrigger id="instance-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ArrKind).map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {KIND_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field id="instance-version" label="Audio version">
              <Select
                items={VERSION_LABELS}
                value={form.version}
                onValueChange={(value) => {
                  if (value) patch({ version: value as AudioVersion });
                }}
              >
                <SelectTrigger id="instance-version" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(AudioVersion).map((version) => (
                    <SelectItem key={version} value={version}>
                      {VERSION_LABELS[version]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field
            id="instance-url"
            label="Address"
            hint="Include the path prefix if the instance sits behind one."
          >
            <Input
              id="instance-url"
              value={form.baseUrl}
              placeholder="https://10.0.0.5:7878"
              className="font-data"
              onChange={(event) => patch({ baseUrl: event.target.value })}
            />
          </Field>

          <Field
            id="instance-key"
            label="API key"
            hint={
              editing
                ? `Saved key ${instance.apiKeyMasked}. Load it to test or save without retyping.`
                : "Settings > General > API Key inside Radarr or Sonarr."
            }
          >
            <div className="flex gap-1.5">
              <Input
                id="instance-key"
                type="password"
                value={form.apiKey}
                placeholder={editing ? instance.apiKeyMasked : "0123456789abcdef"}
                className="font-data"
                onChange={(event) => patch({ apiKey: event.target.value })}
              />
              {editing && (
                <Button
                  variant="outline"
                  disabled={loadingKey}
                  onClick={loadSavedKey}
                >
                  Load saved key
                </Button>
              )}
            </div>
          </Field>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <div className="flex flex-col">
              <Label htmlFor="instance-self-signed">Accept a self-signed certificate</Label>
              <span className="text-xs text-muted-foreground">
                Only for an instance on your own network.
              </span>
            </div>
            <Switch
              id="instance-self-signed"
              checked={form.allowSelfSigned}
              onCheckedChange={(checked) => patch({ allowSelfSigned: checked })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled={testing} onClick={test}>
              {testing ? "Testing…" : "Test connection"}
            </Button>
            {probe && (
              <Data className="text-positive">
                {probe.appName ?? "Connected"} v{probe.version}
              </Data>
            )}
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Field id="instance-profile" label="Quality profile">
            {probe ? (
              <Select
                items={Object.fromEntries(
                  probe.qualityProfiles.map((profile) => [
                    String(profile.id),
                    profile.name,
                  ]),
                )}
                value={
                  form.qualityProfileId === null
                    ? null
                    : String(form.qualityProfileId)
                }
                onValueChange={(value) => {
                  if (value) patch({ qualityProfileId: Number(value) });
                }}
              >
                <SelectTrigger id="instance-profile" className="w-full">
                  <SelectValue placeholder="Pick a quality profile" />
                </SelectTrigger>
                <SelectContent>
                  {probe.qualityProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={String(profile.id)}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <ReadOnlyValue
                value={
                  form.qualityProfileId === null
                    ? "Nothing picked yet"
                    : `Profile ${form.qualityProfileId}`
                }
              />
            )}
          </Field>

          <Field id="instance-root" label="Root folder">
            {probe ? (
              <Select
                items={Object.fromEntries(
                  probe.rootFolders.map((folder) => [folder.path, folder.path]),
                )}
                value={form.rootFolderPath || null}
                onValueChange={(value) => {
                  if (value) patch({ rootFolderPath: value });
                }}
              >
                <SelectTrigger id="instance-root" className="w-full">
                  <SelectValue placeholder="Pick a root folder" />
                </SelectTrigger>
                <SelectContent>
                  {probe.rootFolders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.path}>
                      {folder.path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <ReadOnlyValue value={form.rootFolderPath || "Nothing picked yet"} />
            )}
          </Field>

          {!probe && (
            <p className="text-xs text-muted-foreground">
              Test the connection to change the profile and the folder.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <Label htmlFor="instance-enabled">Enabled</Label>
              <Switch
                id="instance-enabled"
                checked={form.enabled}
                onCheckedChange={(checked) => patch({ enabled: checked })}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <div className="flex flex-col">
                <Label htmlFor="instance-default">Default for this pair</Label>
                <span className="text-xs text-muted-foreground">
                  Used when someone asks for this kind and audio version.
                </span>
              </div>
              <Switch
                id="instance-default"
                checked={form.isDefault}
                onCheckedChange={(checked) => patch({ isDefault: checked })}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <ActionButton disabled={!canSave || saving} onClick={save}>
            {editing ? "Save instance" : "Add instance"}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function ReadOnlyValue({ value }: { value: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-2.5 py-1.5">
      <Data className="text-muted-foreground">{value}</Data>
    </div>
  );
}
