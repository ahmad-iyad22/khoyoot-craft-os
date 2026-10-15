import { supabase } from "@/integrations/supabase/client";

export const IMAGE_BUCKET = "product-images";
const PREFIX = `storage://${IMAGE_BUCKET}/`;
const MAX_INPUT_BYTES = 5 * 1024 * 1024 * 4; // raw camera photo before compression
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;

export function isStoredImage(url?: string | null) {
  return !!url && url.startsWith(PREFIX);
}

const cache = new Map<string, { url: string; exp: number }>();

/** Resolve stored image references to a temporary viewable link. */
export async function resolveImageUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  if (!isStoredImage(url)) return url;
  const path = url.slice(PREFIX.length);
  const hit = cache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(path, 60 * 60 * 6);
  if (error || !data) return null;
  cache.set(path, { url: data.signedUrl, exp: Date.now() + 60 * 60 * 5 * 1000 });
  return data.signedUrl;
}

export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("compress"))), "image/jpeg", 0.82),
  );
}

export class ImageUploadError extends Error {}

export async function uploadProductImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new ImageUploadError("IMAGE_ONLY");
  if (file.size > MAX_INPUT_BYTES) throw new ImageUploadError("IMAGE_TOO_LARGE");
  const blob = await compressImage(file);
  if (blob.size > MAX_OUTPUT_BYTES) throw new ImageUploadError("IMAGE_TOO_LARGE");
  const path = `${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return PREFIX + path;
}
