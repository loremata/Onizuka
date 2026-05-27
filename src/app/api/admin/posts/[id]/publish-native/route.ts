import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/api-admin-auth";
import { publishPostItemNative } from "@/lib/social-publish-native";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminApiSession("/admin/posts");
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const result = await publishPostItemNative(id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: "PUBLISH_FAILED" }, { status: 502 });
  }
  return NextResponse.json(result);
}
