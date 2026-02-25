import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PostForm } from "../post-form";

export default async function NewPostPage() {
  const clients = await prisma.client.findMany({
    orderBy: { companyName: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/posts">← Posts</Link>
        </Button>
      </div>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>New post</CardTitle>
          <CardDescription>
            Select client and platform, add caption and at least one image or video. Optional: set a
            scheduled date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PostForm clients={clients} />
        </CardContent>
      </Card>
    </div>
  );
}
