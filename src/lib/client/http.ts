import type { ApiErrorBody } from "@/lib/types";

export class ClientApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }

  get retryAfterSeconds(): number | null {
    const value = (this.details as { retryAfterSeconds?: unknown } | undefined)?.retryAfterSeconds;
    return typeof value === "number" ? value : null;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  form?: FormData;
  token?: string;
}

/** Calls a LectrFlow API route and returns the JSON body, throwing ClientApiError on failure. */
export async function apiRequest<T>(path: string, { method = "GET", body, form, token }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      cache: "no-store",
    });
  } catch {
    throw new ClientApiError(0, "network_error", "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as T | ApiErrorBody | null;
  if (!res.ok) {
    const error = (data as ApiErrorBody | null)?.error;
    throw new ClientApiError(
      res.status,
      error?.code ?? "unknown_error",
      error?.message ?? `Request failed (${res.status})`,
      error?.details,
    );
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}
