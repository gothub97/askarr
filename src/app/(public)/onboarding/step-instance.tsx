"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2Icon, Loader2Icon, OctagonXIcon } from "lucide-react";
import {
  configureWebhookAction,
  createInstanceAction,
  testInstanceConnectionAction,
} from "@/lib/actions/instances";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { ArrKindValue } from "./types";

/**
 * Step 6. The first Radarr or Sonarr instance.
 *
 * The quality profile and the root folder are never typed: they are read off
 * the instance itself during the connection test. A hand-typed profile id is
 * the classic way to end up with a library that silently never grabs anything.
 */

/** What a successful probe hands back, kept local so no server module is imported. */
interface Probe {
  version: string;
  appName: string | null;
  qualityProfiles: { id: number; name: string }[];
  rootFolders: { id: number; path: string; freeSpace: number | null }[];
}

const KIND_LABELS: Record<ArrKindValue, string> = {
  RADARR: "Radarr",
  SONARR: "Sonarr",
};


function formatFreeSpace(bytes: number | null): string | null {
  if (bytes === null) return null;
  const gigabytes = bytes / 1024 ** 3;
  if (gigabytes >= 1024) return `${(gigabytes / 1024).toFixed(1)} TB free`;
  return `${Math.round(gigabytes)} GB free`;
}

export function StepInstance({
  onDone,
  onSkip,
  onBack,
}: {
  onDone: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<ArrKindValue>("RADARR");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [allowSelfSigned, setAllowSelfSigned] = useState(false);

  const [probe, setProbe] = useState<Probe | null>(null);
  const [qualityProfileId, setQualityProfileId] = useState<string | null>(null);
  const [rootFolderPath, setRootFolderPath] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [testing, startTesting] = useTransition();
  const [saving, startSaving] = useTransition();

  const [saved, setSaved] = useState<{ id: string; label: string } | null>(null);
  const [configuringWebhook, setConfiguringWebhook] = useState(false);
  const [webhookDone, setWebhookDone] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);

  /*
   * Any change to the connection details invalidates the probe: the profiles
   * and folders on screen belong to the instance that answered, and offering
   * them for a different address would save a valid-looking, wrong config.
   */
  function invalidateProbe() {
    setProbe(null);
    setQualityProfileId(null);
    setRootFolderPath(null);
  }

  function onTest() {
    setError(null);
    startTesting(async () => {
      const result = await testInstanceConnectionAction({
        label: label || "this instance",
        baseUrl,
        apiKey,
        allowSelfSigned,
      });

      if (!result.ok) {
        invalidateProbe();
        setError(result.message);
        return;
      }

      setProbe({
        version: result.version,
        appName: result.appName,
        qualityProfiles: result.qualityProfiles,
        rootFolders: result.rootFolders,
      });
      // Preselect the first of each so the common case is one click, not three.
      setQualityProfileId(
        result.qualityProfiles[0] ? String(result.qualityProfiles[0].id) : null,
      );
      setRootFolderPath(result.rootFolders[0]?.path ?? null);
    });
  }

  function onSave() {
    setError(null);
    startSaving(async () => {
      const result = await createInstanceAction({
        label,
        kind,
        baseUrl,
        apiKey,
        qualityProfileId: Number(qualityProfileId),
        rootFolderPath,
        allowSelfSigned,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      toast.success(`${result.instance.label} saved.`);
      /*
       * Saved is not connected. Askarr only hears that a film landed when the
       * instance calls its webhook, and that is the step most likely to be put
       * off and then forgotten. So the step does not end here: it offers the
       * webhook, and the operator leaves when they choose to.
       */
      setSaved({ id: result.instance.id, label: result.instance.label });
    });
  }

  async function onConfigureWebhook() {
    if (!saved) return;
    setWebhookError(null);
    setConfiguringWebhook(true);
    const result = await configureWebhookAction({ id: saved.id });
    setConfiguringWebhook(false);

    if (!result.ok) {
      setWebhookError(result.message ?? "Could not set the webhook up.");
      return;
    }
    setWebhookDone(true);
  }

  const canTest = baseUrl.trim().length > 0 && apiKey.trim().length > 0;
  const canSave =
    probe !== null &&
    label.trim().length > 0 &&
    qualityProfileId !== null &&
    rootFolderPath !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          Connect the first instance
        </CardTitle>
        <CardDescription>
          Test the connection first. The quality profile and root folder are
          read from the instance, not typed.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <OctagonXIcon />
            <AlertTitle>Instance not reachable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="instance-kind">Kind</Label>
            <Select
              value={kind}
              onValueChange={(value) => {
                if (value) setKind(value as ArrKindValue);
              }}
            >
              <SelectTrigger
                id="instance-kind"
                aria-label="Kind"
                className="w-full"
              >
                <SelectValue>
                  {(value: string | null) =>
                    KIND_LABELS[(value ?? "RADARR") as ArrKindValue]
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RADARR">{KIND_LABELS.RADARR}</SelectItem>
                <SelectItem value="SONARR">{KIND_LABELS.SONARR}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="instance-label">Name</Label>
          <Input
            id="instance-label"
            placeholder="Radarr French"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="instance-url">Address</Label>
          <Input
            id="instance-url"
            inputMode="url"
            placeholder="https://10.0.0.5:7878"
            className="font-data"
            value={baseUrl}
            onChange={(event) => {
              setBaseUrl(event.target.value);
              invalidateProbe();
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="instance-api-key">API key</Label>
          <Input
            id="instance-api-key"
            type="password"
            autoComplete="off"
            className="font-data"
            aria-describedby="instance-api-key-hint"
            value={apiKey}
            onChange={(event) => {
              setApiKey(event.target.value);
              invalidateProbe();
            }}
          />
          <p id="instance-api-key-hint" className="text-sm text-muted-foreground">
            Settings → General → API Key, on the instance.
          </p>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="instance-self-signed">
              Allow self-signed certificate
            </Label>
            <p className="text-sm text-muted-foreground">
              Turn this on for an HTTPS instance with its own certificate.
            </p>
          </div>
          <Switch
            id="instance-self-signed"
            checked={allowSelfSigned}
            onCheckedChange={(checked) => {
              setAllowSelfSigned(checked);
              invalidateProbe();
            }}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={!canTest || testing}
          onClick={onTest}
        >
          {testing && <Loader2Icon className="animate-spin" aria-hidden />}
          {testing ? "Testing connection" : "Test connection"}
        </Button>

        {probe && (
          <>
            <Alert>
              <CheckCircle2Icon className="text-positive" />
              <AlertTitle className="text-positive">Connected</AlertTitle>
              <AlertDescription>
                <span className="text-foreground">
                  {probe.appName ?? "Instance"}
                </span>{" "}
                version <span className="font-data">{probe.version}</span>
              </AlertDescription>
            </Alert>

            <Separator />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="instance-profile">Quality profile</Label>
              <Select
                value={qualityProfileId}
                onValueChange={(value) => setQualityProfileId(value)}
              >
                <SelectTrigger
                  id="instance-profile"
                  aria-label="Quality profile"
                  className="w-full"
                >
                  <SelectValue>
                    {(value: string | null) =>
                      probe.qualityProfiles.find(
                        (profile) => String(profile.id) === value,
                      )?.name ?? "Pick a quality profile"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {probe.qualityProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={String(profile.id)}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="instance-root">Root folder</Label>
              <Select
                value={rootFolderPath}
                onValueChange={(value) => setRootFolderPath(value)}
              >
                <SelectTrigger
                  id="instance-root"
                  aria-label="Root folder"
                  className="w-full"
                >
                  <SelectValue>
                    {(value: string | null) => (
                      <span className="font-data">
                        {value ?? "Pick a root folder"}
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {probe.rootFolders.map((folder) => {
                    const free = formatFreeSpace(folder.freeSpace);
                    return (
                      <SelectItem key={folder.id} value={folder.path}>
                        <span className="font-data">{folder.path}</span>
                        {free && (
                          <span className="text-sm text-muted-foreground">
                            {free}
                          </span>
                        )}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {saved && (
          <>
            <Separator />

            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-bold text-foreground">
                Let {saved.label} call back
              </h2>
              <p className="text-sm text-muted-foreground">
                Askarr registers the webhook over the API, so there is no URL to
                paste into Settings and no guessing which events to tick. It
                reads those off the instance&apos;s own schema, because Radarr
                and Sonarr name them differently.
              </p>

              {webhookError && (
                <Alert variant="destructive">
                  <OctagonXIcon />
                  <AlertTitle>Webhook not set up</AlertTitle>
                  <AlertDescription>{webhookError}</AlertDescription>
                </Alert>
              )}

              {webhookDone ? (
                <Alert variant="success">
                  <CheckCircle2Icon />
                  <AlertTitle>Webhook registered</AlertTitle>
                  <AlertDescription>
                    {saved.label} will tell Askarr when something lands.
                  </AlertDescription>
                </Alert>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit"
                  disabled={configuringWebhook}
                  onClick={onConfigureWebhook}
                >
                  {configuringWebhook && (
                    <Loader2Icon className="animate-spin" aria-hidden />
                  )}
                  {configuringWebhook
                    ? "Setting the webhook up"
                    : "Set the webhook up"}
                </Button>
              )}
            </section>
          </>
        )}

        <Separator />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="ghost" size="lg" onClick={onBack}>
              Back
            </Button>
            {!saved && (
              <Button type="button" variant="ghost" size="lg" onClick={onSkip}>
                Skip for now
              </Button>
            )}
          </div>
          {saved ? (
            <Button type="button" size="lg" onClick={onDone}>
              Continue
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              disabled={!canSave || saving}
              onClick={onSave}
            >
              {saving && <Loader2Icon className="animate-spin" aria-hidden />}
              {saving ? "Saving instance" : "Save instance"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
