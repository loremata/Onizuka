import { verifyOutreachDraftToken, recordOutreachOpen, outreachTrackingPixelBuffer } from "@/lib/outreach-tracking";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ draftId: string; token: string }> }
) {
  const { draftId, token } = await params;

  if (verifyOutreachDraftToken(draftId, token)) {
    await recordOutreachOpen(draftId).catch(() => undefined);
  }

  return new Response(new Uint8Array(outreachTrackingPixelBuffer()), {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
