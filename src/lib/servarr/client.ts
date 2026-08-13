import { Agent } from "undici";

/**
 * Low-level HTTP client for Radarr/Sonarr v3 APIs.
 *
 * Three things this file exists to get right:
 *  - base paths: an instance may live behind a prefix (https://host/admin/radarr)
 *  - self-signed certificates, scoped to the instance and never process-wide
 *  - a 10s timeout, so an unreachable instance can never block the bot
 */

const REQUEST_TIMEOUT_MS = 10_000;

export type ArrErrorKind =
  | "timeout"
  | "network"
  | "tls"
  | "unauthorized"
  | "not_found"
  | "http"
  | "malformed";

/**
 * Every failure surfaces as an ArrError carrying a hint that is safe and
 * useful to show to a user as-is.
 */
export class ArrError extends Error {
  readonly kind: ArrErrorKind;
  readonly status?: number;
  readonly instanceLabel: string;
  readonly hint: string;

  constructor(params: {
    kind: ArrErrorKind;
    message: string;
    hint: string;
    instanceLabel: string;
    status?: number;
    cause?: unknown;
  }) {
    super(params.message, { cause: params.cause });
    this.name = "ArrError";
    this.kind = params.kind;
    this.status = params.status;
    this.instanceLabel = params.instanceLabel;
    this.hint = params.hint;
  }
}

/**
 * A dedicated dispatcher that skips certificate validation. Instances opting
 * into self-signed certificates share this one; validation stays on everywhere
 * else. Setting NODE_TLS_REJECT_UNAUTHORIZED would disable it process-wide.
 */
let insecureAgent: Agent | undefined;
function getInsecureAgent(): Agent {
  insecureAgent ??= new Agent({ connect: { rejectUnauthorized: false } });
  return insecureAgent;
}

/**
 * Joins an API path onto a base URL while preserving any path prefix the base
 * URL carries. `new URL("/api/v3/x", base)` is a trap: it is absolute, so it
 * discards the prefix and silently targets the wrong endpoint.
 */
export function joinArrUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new Error(`Invalid base URL: ${baseUrl}`);
  }

  const prefix = base.pathname.replace(/\/+$/, "");
  const suffix = path.replace(/^\/+/, "");
  base.pathname = `${prefix}/${suffix}`;

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) base.searchParams.set(key, String(value));
    }
  }
  return base.toString();
}

export interface ArrConnection {
  label: string;
  baseUrl: string;
  apiKey: string;
  allowSelfSigned: boolean;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Overrides the default timeout; the connection test uses a shorter one. */
  timeoutMs?: number;
}

export async function arrRequest<T>(
  connection: ArrConnection,
  options: RequestOptions,
): Promise<T> {
  const { label, baseUrl, apiKey, allowSelfSigned } = connection;
  const method = options.method ?? "GET";

  let url: string;
  try {
    url = joinArrUrl(baseUrl, options.path, options.query);
  } catch {
    throw new ArrError({
      kind: "malformed",
      message: `Invalid base URL for ${label}`,
      hint: `The address for ${label} is not a valid URL. Expected something like https://10.0.0.5:7878.`,
      instanceLabel: label,
    });
  }

  const init: RequestInit & { dispatcher?: Agent } = {
    method,
    // The API key goes in a header. Never in a query string: those end up in
    // access logs and browser history.
    headers: {
      "X-Api-Key": apiKey,
      Accept: "application/json",
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS),
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  };

  if (allowSelfSigned) init.dispatcher = getInsecureAgent();

  let response: Response;
  try {
    response = await fetch(url, init as RequestInit);
  } catch (cause) {
    throw toTransportError(cause, label, allowSelfSigned);
  }

  if (!response.ok) {
    const detail = await safeReadText(response);
    throw toHttpError(response.status, detail, label);
  }

  // 204 and empty bodies are legitimate for DELETE.
  const text = await safeReadText(response);
  if (!text) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ArrError({
      kind: "malformed",
      message: `Unreadable response from ${label}`,
      hint: `${label} answered with something that is not JSON. Check that the address points at the API and not at a login page or a reverse proxy error.`,
      instanceLabel: label,
    });
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return (await response.text()).trim();
  } catch {
    return "";
  }
}

function toHttpError(status: number, detail: string, label: string): ArrError {
  if (status === 401 || status === 403) {
    return new ArrError({
      kind: "unauthorized",
      status,
      message: `${label} rejected the API key`,
      hint: `${label} refused the API key. Copy it again from Settings > General on the instance.`,
      instanceLabel: label,
    });
  }
  if (status === 404) {
    return new ArrError({
      kind: "not_found",
      status,
      message: `${label} has no endpoint at that address`,
      hint: `${label} returned 404. Check the address, including any path prefix such as /radarr.`,
      instanceLabel: label,
    });
  }
  return new ArrError({
    kind: "http",
    status,
    message: `${label} returned ${status}`,
    hint: `${label} returned HTTP ${status}${detail ? `: ${truncate(detail, 200)}` : "."}`,
    instanceLabel: label,
  });
}

function toTransportError(
  cause: unknown,
  label: string,
  allowSelfSigned: boolean,
): ArrError {
  const name = cause instanceof Error ? cause.name : "";
  const code = extractErrorCode(cause);

  if (name === "TimeoutError" || code === "UND_ERR_CONNECT_TIMEOUT") {
    return new ArrError({
      kind: "timeout",
      message: `${label} did not answer in time`,
      hint: `${label} did not answer within 10 seconds. Check that it is running and reachable from Askarr.`,
      instanceLabel: label,
      cause,
    });
  }

  if (isTlsCode(code)) {
    return new ArrError({
      kind: "tls",
      message: `${label} presented a certificate that could not be verified`,
      hint: allowSelfSigned
        ? `${label} presented a certificate that could not be verified even with self-signed certificates allowed. Check the address and the certificate on the instance.`
        : `${label} presented a self-signed or untrusted certificate. Tick "Allow self-signed certificate" on this instance to accept it.`,
      instanceLabel: label,
      cause,
    });
  }

  return new ArrError({
    kind: "network",
    message: `${label} is unreachable`,
    hint: `Could not reach ${label}${code ? ` (${code})` : ""}. Check the address and that Askarr can reach it on the network.`,
    instanceLabel: label,
    cause,
  });
}

/** Node nests the real failure under `cause`, sometimes more than one level. */
function extractErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

function isTlsCode(code: string | undefined): boolean {
  if (!code) return false;
  return (
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "SELF_SIGNED_CERT_IN_CHAIN" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "CERT_HAS_EXPIRED" ||
    code === "ERR_TLS_CERT_ALTNAME_INVALID" ||
    code.startsWith("ERR_TLS")
  );
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
