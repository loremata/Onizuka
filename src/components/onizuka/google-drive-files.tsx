import Link from "next/link";
import {
  extractDriveFolderIdFromUrl,
  isGoogleDriveServiceAccountConfigured,
  listDriveFolderFiles,
} from "@/lib/google-drive-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export async function GoogleDriveFilesCard({
  driveFolderUrl,
}: {
  driveFolderUrl: string | null;
}) {
  if (!isGoogleDriveServiceAccountConfigured() || !driveFolderUrl) return null;

  const folderId = extractDriveFolderIdFromUrl(driveFolderUrl);
  if (!folderId) return null;

  const files = await listDriveFolderFiles(folderId, 12);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">File su Google Drive</CardTitle>
        <CardDescription>
          Elenco da API (sola lettura).{" "}
          <Link href={driveFolderUrl} className="text-primary hover:underline" target="_blank" rel="noreferrer">
            Apri cartella
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cartella vuota o accesso non condiviso col service account.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 border-b border-border/40 pb-2 last:border-0">
                <span className="truncate">{f.name}</span>
                {f.webViewLink ? (
                  <Link
                    href={f.webViewLink}
                    className="shrink-0 text-xs text-primary hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Apri
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
