export function isLinkedInNativePublishConfigured(): boolean {
  return !!(
    process.env.LINKEDIN_ACCESS_TOKEN?.trim() && process.env.LINKEDIN_AUTHOR_URN?.trim()
  );
}

export async function publishPostToLinkedIn(params: {
  text: string;
  mediaUrl?: string;
}): Promise<{ externalId: string } | { error: string }> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN?.trim();
  const author = process.env.LINKEDIN_AUTHOR_URN?.trim();
  if (!token || !author) {
    return { error: "Configura LINKEDIN_ACCESS_TOKEN e LINKEDIN_AUTHOR_URN (es. urn:li:organization:123)." };
  }

  const body: Record<string, unknown> = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: params.text.slice(0, 3000) },
        shareMediaCategory: params.mediaUrl ? "ARTICLE" : "NONE",
        ...(params.mediaUrl
          ? {
              media: [
                {
                  status: "READY",
                  originalUrl: params.mediaUrl,
                },
              ],
            }
          : {}),
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return { error: `LinkedIn API ${res.status}: ${(await res.text()).slice(0, 400)}` };
  }
  const id = res.headers.get("x-restli-id") ?? "linkedin-post";
  return { externalId: id };
}
