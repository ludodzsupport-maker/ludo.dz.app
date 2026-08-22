const DEFAULT_TIMEOUT_MS = 30_000;
const CHAT_COMPLETIONS_PATH = "/chat/completions";
const MODELS_PATH = "/models";

export type OmniRouteRole = "system" | "user" | "assistant" | "tool";

export type OmniRouteChatMessage = {
  role: OmniRouteRole;
  content: string | Array<Record<string, unknown>> | null;
  name?: string;
  tool_call_id?: string;
  [key: string]: unknown;
};

export type OmniRouteChatCompletionRequest = {
  model: string;
  messages: OmniRouteChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  [key: string]: unknown;
};

export type OmniRouteModel = {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
  [key: string]: unknown;
};

export type OmniRouteModelsResponse = {
  object?: string;
  data: OmniRouteModel[];
  [key: string]: unknown;
};

export type OmniRouteChatCompletionResponse = {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<Record<string, unknown>>;
  usage?: Record<string, unknown>;
  [key: string]: unknown;
};

export type OmniRouteClientConfig = {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type OmniRouteValidationResult = {
  ok: true;
  baseUrl: string;
  modelCount: number;
  sampleModelIds: string[];
  chatCompletionId?: string;
};

export class OmniRouteConfigError extends Error {
  readonly name = "OmniRouteConfigError";
}

export class OmniRouteApiError extends Error {
  readonly name = "OmniRouteApiError";
  readonly status: number;
  readonly statusText: string;
  readonly responseBody: unknown;

  constructor(response: Response, responseBody: unknown) {
    super(buildApiErrorMessage(response, responseBody));
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.responseBody = responseBody;
  }
}

export class OmniRouteResponseParseError extends Error {
  readonly name = "OmniRouteResponseParseError";
  readonly rawBody: string;
  readonly cause: unknown;

  constructor(rawBody: string, cause: unknown) {
    super("OmniRoute returned a non-JSON response.");
    Object.setPrototypeOf(this, new.target.prototype);

    this.rawBody = rawBody;
    this.cause = cause;
  }
}

export function getOmniRouteConfig(overrides: OmniRouteClientConfig = {}): Required<OmniRouteClientConfig> {
  assertServerRuntime();

  const apiKey = overrides.apiKey ?? readEnv("OMNIROUTE_API_KEY");
  const baseUrl = overrides.baseUrl ?? readEnv("OMNIROUTE_BASE_URL");
  const timeoutMs = overrides.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch;

  if (!apiKey) {
    throw new OmniRouteConfigError("OMNIROUTE_API_KEY is required for OmniRoute requests.");
  }

  if (!baseUrl) {
    throw new OmniRouteConfigError("OMNIROUTE_BASE_URL is required for OmniRoute requests.");
  }

  if (typeof fetchImpl !== "function") {
    throw new OmniRouteConfigError("A fetch implementation is required in this runtime.");
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new OmniRouteConfigError("OmniRoute timeoutMs must be a positive number.");
  }

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(baseUrl),
    timeoutMs,
    fetchImpl,
  };
}

export function createOmniRouteClient(config: OmniRouteClientConfig = {}) {
  const resolved = getOmniRouteConfig(config);

  return {
    baseUrl: resolved.baseUrl,
    chatCompletions: (body: OmniRouteChatCompletionRequest, options?: { signal?: AbortSignal }) =>
      requestOmniRoute<OmniRouteChatCompletionResponse>(resolved, CHAT_COMPLETIONS_PATH, {
        method: "POST",
        body,
        signal: options?.signal,
      }),
    listModels: (options?: { signal?: AbortSignal }) =>
      requestOmniRoute<OmniRouteModelsResponse>(resolved, MODELS_PATH, {
        method: "GET",
        signal: options?.signal,
      }),
  };
}

export async function validateOmniRouteConnection(
  config: OmniRouteClientConfig & { validationModel?: string } = {},
): Promise<OmniRouteValidationResult> {
  const client = createOmniRouteClient(config);
  const models = await client.listModels();
  const sampleModelIds = Array.isArray(models.data)
    ? models.data.slice(0, 5).map((model) => model.id).filter(Boolean)
    : [];

  let chatCompletionId: string | undefined;
  const validationModel = config.validationModel ?? readEnv("OMNIROUTE_VALIDATION_MODEL");

  if (validationModel) {
    const chatResponse = await client.chatCompletions({
      model: validationModel,
      messages: [
        {
          role: "user",
          content: "Reply with exactly: ok",
        },
      ],
      max_tokens: 4,
      temperature: 0,
    });
    chatCompletionId = typeof chatResponse.id === "string" ? chatResponse.id : undefined;
  }

  return {
    ok: true,
    baseUrl: client.baseUrl,
    modelCount: Array.isArray(models.data) ? models.data.length : 0,
    sampleModelIds,
    chatCompletionId,
  };
}

async function requestOmniRoute<T>(
  config: Required<OmniRouteClientConfig>,
  pathName: string,
  request: {
    method: "GET" | "POST";
    body?: unknown;
    signal?: AbortSignal;
  },
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await config.fetchImpl(buildUrl(config.baseUrl, pathName), {
      method: request.method,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${config.apiKey}`,
        ...(request.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: mergeAbortSignals(controller.signal, request.signal),
    });

    const parsedBody = await parseJsonOrText(response);

    if (!response.ok) {
      throw new OmniRouteApiError(response, parsedBody);
    }

    return parsedBody as T;
  } finally {
    clearTimeout(timeout);
  }
}

function readEnv(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new OmniRouteConfigError(
      "OmniRoute client is server-only. Do not import it into browser/client code because it uses OMNIROUTE_API_KEY.",
    );
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");

  try {
    // Validate early so misconfigured deploys fail before sending requests.
    new URL(trimmed);
  } catch {
    throw new OmniRouteConfigError("OMNIROUTE_BASE_URL must be an absolute URL.");
  }

  return trimmed.endsWith(CHAT_COMPLETIONS_PATH)
    ? trimmed.slice(0, -CHAT_COMPLETIONS_PATH.length)
    : trimmed;
}

function buildUrl(baseUrl: string, pathName: string): string {
  return `${baseUrl}${pathName}`;
}

async function parseJsonOrText(response: Response): Promise<unknown> {
  const rawBody = await response.text();

  if (rawBody.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch (cause) {
    if (!response.ok) return rawBody;
    throw new OmniRouteResponseParseError(rawBody, cause);
  }
}

function mergeAbortSignals(primary: AbortSignal, secondary?: AbortSignal): AbortSignal {
  if (!secondary) return primary;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([primary, secondary]);
  }

  const controller = new AbortController();
  const abort = () => controller.abort();

  if (primary.aborted || secondary.aborted) {
    controller.abort();
  } else {
    primary.addEventListener("abort", abort, { once: true });
    secondary.addEventListener("abort", abort, { once: true });
  }

  return controller.signal;
}

function buildApiErrorMessage(response: Response, responseBody: unknown): string {
  const detail = extractErrorDetail(responseBody);
  return detail
    ? `OmniRoute request failed with HTTP ${response.status} ${response.statusText}: ${detail}`
    : `OmniRoute request failed with HTTP ${response.status} ${response.statusText}`;
}

function extractErrorDetail(responseBody: unknown): string | undefined {
  if (typeof responseBody === "string") {
    return truncate(responseBody.trim());
  }

  if (!responseBody || typeof responseBody !== "object") return undefined;

  const body = responseBody as Record<string, unknown>;
  const directMessage = firstString(body.message, body.error_description, body.detail);
  if (directMessage) return truncate(directMessage);

  const nestedError = body.error;
  if (typeof nestedError === "string") return truncate(nestedError);
  if (nestedError && typeof nestedError === "object") {
    const errorRecord = nestedError as Record<string, unknown>;
    return truncate(firstString(errorRecord.message, errorRecord.type, errorRecord.code) ?? "");
  }

  return undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return undefined;
}

function truncate(text: string, maxLength = 300): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
