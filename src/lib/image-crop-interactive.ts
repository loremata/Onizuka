/** Ritaglio quadrato con pan/zoom (canvas). */

export type CropTransform = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export async function cropImageWithTransform(
  file: File,
  transform: CropTransform,
  outputSize = 1080
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile.");

  const zoom = Math.max(1, Math.min(transform.zoom, 4));
  const cropSide = side / zoom;
  const maxPan = (side - cropSide) / 2;
  const panX = Math.max(-maxPan, Math.min(maxPan, transform.offsetX));
  const panY = Math.max(-maxPan, Math.min(maxPan, transform.offsetY));
  const sx = (bitmap.width - side) / 2 + panX;
  const sy = (bitmap.height - side) / 2 + panY;

  ctx.drawImage(bitmap, sx, sy, cropSide, cropSide, 0, 0, outputSize, outputSize);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Export immagine fallito."))),
      "image/jpeg",
      0.92
    );
  });

  const baseName = file.name.replace(/\.[^.]+$/, "") || "immagine";
  return new File([blob], `${baseName}-crop.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}
