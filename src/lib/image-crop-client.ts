/** Ritaglio quadrato centrato lato client (Instagram / GBP). */

export async function cropImageFileToSquare(
  file: File,
  outputSize = 1080
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = Math.floor((bitmap.width - side) / 2);
  const sy = Math.floor((bitmap.height - side) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile.");

  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, outputSize, outputSize);
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

export async function applySquareCropToFileList(
  files: File[],
  onlyImages = true
): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    if (onlyImages && file.type.startsWith("image/")) {
      out.push(await cropImageFileToSquare(file));
    } else {
      out.push(file);
    }
  }
  return out;
}
