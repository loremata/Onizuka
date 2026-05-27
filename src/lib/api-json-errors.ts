import { NextResponse } from "next/server";

/**
 * Codici errore stabili per automazioni (n8n, script). Il campo `error` resta in italiano per operatori umani.
 */
export const ApiErrorCode = {
  RATE_LIMIT: "RATE_LIMIT",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  N8N_KEY_NOT_CONFIGURED: "N8N_KEY_NOT_CONFIGURED",
  MISSING_CLIENT_SLUG: "MISSING_CLIENT_SLUG",
  CLIENT_NOT_FOUND: "CLIENT_NOT_FOUND",
  INVALID_JSON: "INVALID_JSON",
  MISSING_POST_ITEM_ID: "MISSING_POST_ITEM_ID",
  INVALID_PUBLISHED_AT: "INVALID_PUBLISHED_AT",
  POST_NOT_FOUND: "POST_NOT_FOUND",
  MISSING_CLIENT_ID: "MISSING_CLIENT_ID",
  DELETE_CLIENT_FAILED: "DELETE_CLIENT_FAILED",
  WEBHOOK_NOT_FOUND: "WEBHOOK_NOT_FOUND",
  LOCAL_UPLOAD_DISABLED: "LOCAL_UPLOAD_DISABLED",
  LOGIN_RATE_LIMIT: "LOGIN_RATE_LIMIT",
  DATABASE_NOT_READY: "DATABASE_NOT_READY",
} as const;

export type ApiErrorCodeType = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export function jsonApiError(
  status: number,
  code: ApiErrorCodeType,
  message: string,
  headers?: HeadersInit
): NextResponse {
  return NextResponse.json({ error: message, code }, { status, headers });
}
