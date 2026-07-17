function metaAccessToken(): string | null {
  return process.env.META_PAGE_ACCESS_TOKEN?.trim() || process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() || null;
}

function metaPageId(): string | null {
  return process.env.META_PAGE_ID?.trim() || process.env.FACEBOOK_PAGE_ID?.trim() || null;
}

export function isMetaNativePublishConfigured(): boolean {
  return !!(metaAccessToken() && metaPageId());
}

export async function publishPostToMetaPage(params: {
  message: string;
  link?: string;
  /// Override per-account (Publisher multi-tenant). Se assenti, fallback ai token env.
  accessToken?: string;
  pageId?: string;
}): Promise<{ externalId: string; permalink?: string } | { error: string }> {
  const token = params.accessToken?.trim() || metaAccessToken();
  const pageId = params.pageId?.trim() || metaPageId();
  if (!token || !pageId) {
    return { error: "Meta publish non configurato (account senza token o env META_PAGE_ACCESS_TOKEN/META_PAGE_ID)." };
  }

  const body = new URLSearchParams({
    message: params.message.slice(0, 5000),
    access_token: token,
  });
  if (params.link) body.set("link", params.link);

  const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
    method: "POST",
    body,
  });
  const json = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !json.id) {
    return { error: json.error?.message ?? `Graph API ${res.status}` };
  }
  return { externalId: json.id };
}
