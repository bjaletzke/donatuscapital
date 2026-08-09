export type Role = "guest" | "admin";

export interface SessionPayload {
  role: Role;
  exp: number;
}

export interface MediaItem {
  id: string;
  type: "photo" | "video";
  /** Full R2 object key, e.g. "kenya-2026/ab12cd34.jpg" */
  key: string;
  /** Original upload filename, used for "Original" downloads */
  filename: string;
  caption?: string;
  width: number;
  height: number;
  /** Bytes */
  size: number;
  contentType: string;
}

export interface ProjectManifest {
  slug: string;
  title: string;
  description: string;
  date: string;
  /** MediaItem id used as the project cover */
  cover?: string;
  media: MediaItem[];
}

export interface ProjectIndexEntry {
  slug: string;
  title: string;
  date: string;
  cover?: string;
}
