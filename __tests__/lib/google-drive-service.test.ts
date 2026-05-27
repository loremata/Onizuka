import { extractDriveFolderIdFromUrl, isGoogleDriveServiceAccountConfigured } from "@/lib/google-drive-service";

describe("google-drive-service", () => {
  const prev = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;

  afterEach(() => {
    if (prev === undefined) delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
    else process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = prev;
  });

  it("extracts folder id from url", () => {
    expect(
      extractDriveFolderIdFromUrl("https://drive.google.com/drive/folders/abc123XYZ")
    ).toBe("abc123XYZ");
  });

  it("detects configured service account json", () => {
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: "sa@test.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n",
    });
    expect(isGoogleDriveServiceAccountConfigured()).toBe(true);
  });
});
