const N8N_API_KEY = process.env.N8N_API_KEY;

/**
 * Validate n8n API key from request. Supports:
 * - Header: X-API-Key: <key>
 * - Header: Authorization: Bearer <key>
 */
export function validateN8nApiKey(request: Request): boolean {
  if (!N8N_API_KEY) return false;
  const headerKey = request.headers.get("x-api-key");
  if (headerKey && headerKey === N8N_API_KEY) return true;
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    if (token === N8N_API_KEY) return true;
  }
  return false;
}

export function requireN8nAuth(request: Request): { ok: false; status: number } | { ok: true } {
  if (!N8N_API_KEY) {
    return { ok: false, status: 503 };
  }
  if (!validateN8nApiKey(request)) {
    return { ok: false, status: 401 };
  }
  return { ok: true };
}
