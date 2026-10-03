import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ApiErrorBody } from "@/lib/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = "Lecture") => new ApiError(404, "not_found", `${what} not found`);

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  const body: ApiErrorBody = { error: { code, message, ...(details === undefined ? {} : { details }) } };
  return NextResponse.json(body, { status });
}

/** Wraps a route handler so thrown ApiErrors / validation errors become JSON responses. */
export function route<C>(handler: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) return errorResponse(err.status, err.code, err.message, err.details);
      if (err instanceof z.ZodError) {
        return errorResponse(400, "validation_error", "Invalid request", z.flattenError(err));
      }
      console.error(err);
      return errorResponse(500, "internal_error", "Something went wrong");
    }
  };
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be JSON");
  }
  return schema.parse(json);
}

const uuid = z.uuid();

export function parseId(value: string, what = "Lecture"): string {
  if (!uuid.safeParse(value).success) throw notFound(what);
  return value;
}

type DbResult<T> = { data: T | null; error: { message: string } | null };

/** Throws on database errors (surfaced as a 500). For writes that return no rows. */
export function check(result: { error: { message: string } | null }): void {
  if (result.error) throw new Error(`Database error: ${result.error.message}`);
}

/** Unwraps a query that must return data (lists, `.single()`). */
export function must<T>(result: DbResult<T>): T {
  check(result);
  if (result.data === null) throw new Error("Database error: no data returned");
  return result.data;
}

/** Unwraps a `.maybeSingle()` query; null when no row matched. */
export function maybe<T>(result: DbResult<T>): T | null {
  check(result);
  return result.data;
}
