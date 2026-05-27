import { createSign } from "crypto";

export type DriveServiceAccount = {
  client_email: string;
  private_key: string;
};

export type CreatedDriveFolder = {
  folderId: string;
  webViewLink: string;
};

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function isGoogleDriveServiceAccountConfigured(): boolean {
  return Boolean(parseServiceAccount());
}

function parseServiceAccount(): DriveServiceAccount | null {
  const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as DriveServiceAccount;
    if (!sa.client_email || !sa.private_key) return null;
    return sa;
  } catch {
    return null;
  }
}

async function getServiceAccountAccessToken(): Promise<string | null> {
  const sa = parseServiceAccount();
  if (!sa) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/drive.file",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .end()
    .sign(sa.private_key.replace(/\\n/g, "\n"), "base64url");

  const jwt = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

/** Crea cartella Drive per cliente (service account). */
export async function createClientDriveFolder(
  folderName: string
): Promise<CreatedDriveFolder | null> {
  const token = await getServiceAccountAccessToken();
  if (!token) return null;

  const parentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID?.trim();
  const metadata: Record<string, unknown> = {
    name: folderName.slice(0, 200),
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) metadata.parents = [parentId];

  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,webViewLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { id?: string; webViewLink?: string };
  if (!json.id) return null;

  const webViewLink =
    json.webViewLink ?? `https://drive.google.com/drive/folders/${json.id}`;

  return { folderId: json.id, webViewLink };
}

export async function listDriveFolderFiles(
  folderId: string,
  limit = 15
): Promise<Array<{ id: string; name: string; mimeType: string; webViewLink?: string }>> {
  const token = await getServiceAccountAccessToken();
  if (!token) return [];

  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const fields = encodeURIComponent("files(id,name,mimeType,webViewLink)");
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=${limit}&fields=${fields}&orderBy=modifiedTime desc`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) return [];
  const json = (await res.json()) as {
    files?: Array<{ id: string; name: string; mimeType: string; webViewLink?: string }>;
  };
  return json.files ?? [];
}

export function extractDriveFolderIdFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? null;
}

/** Sottocartella per nome (es. 04_Audit). */
export async function findDriveChildFolder(
  parentFolderId: string,
  folderName: string
): Promise<string | null> {
  const token = await getServiceAccountAccessToken();
  if (!token) return null;

  const safeName = folderName.replace(/'/g, "\\'");
  const q = encodeURIComponent(
    `'${parentFolderId}' in parents and name='${safeName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=1&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { files?: Array<{ id: string }> };
  return json.files?.[0]?.id ?? null;
}

export async function createDriveSubfolder(
  parentFolderId: string,
  folderName: string
): Promise<CreatedDriveFolder | null> {
  const existing = await findDriveChildFolder(parentFolderId, folderName);
  if (existing) {
    return {
      folderId: existing,
      webViewLink: `https://drive.google.com/drive/folders/${existing}`,
    };
  }

  const token = await getServiceAccountAccessToken();
  if (!token) return null;

  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,webViewLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName.slice(0, 200),
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { id?: string; webViewLink?: string };
  if (!json.id) return null;
  return {
    folderId: json.id,
    webViewLink: json.webViewLink ?? `https://drive.google.com/drive/folders/${json.id}`,
  };
}

export type UploadedDriveFile = {
  fileId: string;
  webViewLink: string;
};

/** Carica file binario in una cartella Drive. */
export async function uploadDriveFile(params: {
  parentFolderId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<UploadedDriveFile | null> {
  const token = await getServiceAccountAccessToken();
  if (!token) return null;

  const boundary = `onizuka_${Date.now()}`;
  const meta = JSON.stringify({
    name: params.filename.slice(0, 200),
    parents: [params.parentFolderId],
  });

  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${params.mimeType}\r\n\r\n`,
    "utf-8"
  );
  const closing = Buffer.from(`\r\n--${boundary}--`, "utf-8");
  const body = Buffer.concat([preamble, params.buffer, closing]);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) return null;
  const json = (await res.json()) as { id?: string; webViewLink?: string };
  if (!json.id) return null;
  return {
    fileId: json.id,
    webViewLink: json.webViewLink ?? `https://drive.google.com/file/d/${json.id}/view`,
  };
}
