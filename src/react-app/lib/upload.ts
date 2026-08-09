import exifr from "exifr";
import type { MediaItem } from "../../shared/types";
import { api } from "./api";

/** Single-request limit; larger files go through R2 multipart. */
const SINGLE_LIMIT = 95 * 1024 * 1024;
const CHUNK = 50 * 1024 * 1024;

async function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  try {
    const bmp = await createImageBitmap(file);
    const d = { width: bmp.width, height: bmp.height };
    bmp.close();
    return d;
  } catch {
    return { width: 0, height: 0 };
  }
}

function videoDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      resolve({ width: v.videoWidth, height: v.videoHeight });
      URL.revokeObjectURL(url);
    };
    v.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    v.src = url;
  });
}

function xhrUpload(
  url: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<MediaItem> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as MediaItem);
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}

/** EXIF capture time + IPTC/XMP keywords, falling back to file mtime. */
async function extractMeta(
  file: File,
  type: "photo" | "video"
): Promise<{ takenAt: string; keywords: string[] }> {
  const fallback = new Date(file.lastModified).toISOString();
  if (type !== "photo") return { takenAt: fallback, keywords: [] };
  try {
    const data = await exifr.parse(file, { iptc: true, xmp: true });
    const taken = data?.DateTimeOriginal ?? data?.CreateDate;
    const raw = data?.Keywords ?? data?.subject;
    const keywords = (Array.isArray(raw) ? raw : raw ? [raw] : [])
      .map((k: unknown) => String(k).trim())
      .filter(Boolean);
    return {
      takenAt: taken instanceof Date && !Number.isNaN(taken.getTime()) ? taken.toISOString() : fallback,
      keywords,
    };
  } catch {
    return { takenAt: fallback, keywords: [] };
  }
}

export async function uploadFile(
  slug: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<MediaItem> {
  const type = file.type.startsWith("video/") ? "video" : "photo";
  const dims = type === "photo" ? await imageDimensions(file) : await videoDimensions(file);
  const meta = await extractMeta(file, type);
  const qs =
    `filename=${encodeURIComponent(file.name)}&type=${type}&width=${dims.width}&height=${dims.height}` +
    `&takenAt=${encodeURIComponent(meta.takenAt)}&keywords=${encodeURIComponent(meta.keywords.join(","))}`;

  if (file.size <= SINGLE_LIMIT) {
    return xhrUpload(`/api/projects/${slug}/media?${qs}`, file, onProgress);
  }

  const { key, uploadId } = await api<{ key: string; uploadId: string }>(
    `/api/projects/${slug}/media/multipart/create?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`,
    { method: "POST" }
  );
  const parts: Array<{ partNumber: number; etag: string }> = [];
  const total = Math.ceil(file.size / CHUNK);
  for (let i = 0; i < total; i++) {
    const blob = file.slice(i * CHUNK, Math.min((i + 1) * CHUNK, file.size));
    const res = await fetch(
      `/api/projects/${slug}/media/multipart/${uploadId}/part?key=${encodeURIComponent(key)}&part=${i + 1}`,
      { method: "PUT", body: blob }
    );
    if (!res.ok) throw new Error(`Part ${i + 1} failed (${res.status})`);
    parts.push((await res.json()) as { partNumber: number; etag: string });
    onProgress(Math.round(((i + 1) / total) * 100));
  }
  return api<MediaItem>(`/api/projects/${slug}/media/multipart/complete`, {
    method: "POST",
    body: JSON.stringify({
      key,
      uploadId,
      parts,
      filename: file.name,
      type,
      width: dims.width,
      height: dims.height,
      takenAt: meta.takenAt,
      keywords: meta.keywords,
    }),
  });
}
