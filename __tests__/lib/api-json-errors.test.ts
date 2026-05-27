import { ApiErrorCode, jsonApiError } from "@/lib/api-json-errors";

describe("jsonApiError", () => {
  it("serializza error e code", async () => {
    const res = jsonApiError(400, ApiErrorCode.MISSING_CLIENT_SLUG, "Parametro clientSlug obbligatorio");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Parametro clientSlug obbligatorio",
      code: "MISSING_CLIENT_SLUG",
    });
  });

  it("propaga header opzionali", async () => {
    const res = jsonApiError(429, ApiErrorCode.RATE_LIMIT, "Troppe richieste", {
      "Retry-After": "12",
    });
    expect(res.headers.get("Retry-After")).toBe("12");
  });
});
