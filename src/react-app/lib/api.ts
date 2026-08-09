export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      message = ((await res.json()) as { error?: string }).error ?? message;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export const rawUrl = (key: string) => `/api/media/${key}`;

export const variantUrl = (key: string, w: number, format = "webp") =>
  `/api/media/${key}/variant?w=${w}&format=${format}`;

export const downloadUrl = (slug: string, id: string, size: string, format?: string) =>
  `/api/projects/${slug}/media/${id}/download?size=${size}${format ? `&format=${format}` : ""}`;
