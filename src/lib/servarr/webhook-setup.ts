import { arrRequest, type ArrConnection } from "./client";

/**
 * Registering Askarr's webhook on the instance, instead of asking an admin to
 * paste a URL into Settings > Connect.
 *
 * Askarr learns everything through this webhook — it is the only channel. An
 * install where nobody set it up looks exactly like a broken one: requests sit
 * at "queued" forever while the film is already on disk, and nothing ever says
 * why. Doing it over the API removes the step that is easiest to skip.
 *
 * The event flags are read off the instance's own schema rather than
 * hardcoded, because Radarr and Sonarr name them differently
 * (onMovieAdded vs onSeriesAdd) and the set grows between versions.
 */

/** The Askarr events; the rest stay off. Keep in step with the webhook route. */
const WANTED_EVENTS = [
  "onGrab",
  "onDownload",
  "onUpgrade",
  "onMovieAdded",
  "onSeriesAdd",
] as const;

const NAME = "Askarr";

interface NotificationField {
  name: string;
  value?: unknown;
}

interface Notification {
  id?: number;
  name?: string;
  implementation?: string;
  configContract?: string;
  fields?: NotificationField[];
  [key: string]: unknown;
}

export type WebhookSetupOutcome = "created" | "updated" | "current";

function urlOf(notification: Notification): string | null {
  const field = (notification.fields ?? []).find((f) => f.name === "url");
  return typeof field?.value === "string" ? field.value : null;
}

/**
 * Turns on every wanted event the instance actually supports.
 *
 * Setting a flag the instance does not know is how a POST gets rejected
 * wholesale, so `supportsOnX` decides rather than a fixed list.
 */
function withEvents(schema: Notification): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  for (const event of WANTED_EVENTS) {
    const supported = schema[`supports${event[0].toUpperCase()}${event.slice(1)}`];
    if (supported === true) flags[event] = true;
  }
  return flags;
}

/**
 * Makes the instance point at `webhookUrl`, creating or correcting the
 * connection as needed. Matching on our own URL path rather than on the name,
 * so a renamed connection is still recognised as ours.
 */
export async function ensureWebhook(
  connection: ArrConnection,
  webhookUrl: string,
  /** The instance id, which appears in our own webhook path. */
  instanceId: string,
): Promise<WebhookSetupOutcome> {
  const existing = await arrRequest<Notification[]>(connection, {
    path: "/api/v3/notification",
  });

  const ours = (existing ?? []).find((n) => {
    const url = urlOf(n);
    return (
      n.implementation === "Webhook" &&
      (url?.includes(`/api/webhooks/arr/${instanceId}`) || n.name === NAME)
    );
  });

  const schemas = await arrRequest<Notification[]>(connection, {
    path: "/api/v3/notification/schema",
  });
  const schema = (schemas ?? []).find((s) => s.implementation === "Webhook");
  if (!schema) {
    throw new Error("This instance does not offer a Webhook connection.");
  }

  const fields = (schema.fields ?? []).map((field) => {
    if (field.name === "url") return { ...field, value: webhookUrl };
    // 1 is POST in Radarr and Sonarr's method select.
    if (field.name === "method") return { ...field, value: 1 };
    return field;
  });

  const payload: Notification = {
    ...schema,
    ...withEvents(schema),
    name: ours?.name ?? NAME,
    fields,
  };

  if (ours?.id) {
    if (urlOf(ours) === webhookUrl) return "current";
    await arrRequest(connection, {
      path: `/api/v3/notification/${ours.id}`,
      method: "PUT",
      body: { ...payload, id: ours.id },
    });
    return "updated";
  }

  await arrRequest(connection, {
    path: "/api/v3/notification",
    method: "POST",
    body: payload,
  });
  return "created";
}
