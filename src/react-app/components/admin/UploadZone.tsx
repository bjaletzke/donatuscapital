import { useRef, useState, type DragEvent } from "react";
import { RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { uploadFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import type { MediaItem } from "../../../shared/types";

interface QueueEntry {
  id: number;
  file: File;
  pct: number;
  status: "uploading" | "done" | "error";
}

interface Props {
  slug: string;
  onUploaded: (item: MediaItem) => void;
}

let nextId = 1;

export default function UploadZone({ slug, onUploaded }: Props) {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (id: number, patch: Partial<QueueEntry>) =>
    setQueue((q) => q.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const start = (file: File, existingId?: number) => {
    const id = existingId ?? nextId++;
    if (existingId === undefined) {
      setQueue((q) => [...q, { id, file, pct: 0, status: "uploading" }]);
    } else {
      update(id, { pct: 0, status: "uploading" });
    }
    uploadFile(slug, file, (pct) => update(id, { pct }))
      .then((item) => {
        update(id, { status: "done", pct: 100 });
        onUploaded(item);
        setTimeout(() => setQueue((q) => q.filter((e) => e.id !== id)), 1500);
      })
      .catch(() => {
        update(id, { status: "error" });
        toast.error(`${file.name} failed to upload`);
      });
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) start(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  return (
    <div className="mb-10">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex w-full flex-col items-center gap-2 border border-dashed px-6 py-10 text-sm transition-colors",
          dragOver ? "border-ink bg-ink/5" : "border-ink/25 hover:border-ink/50"
        )}
      >
        <Upload className="h-5 w-5 opacity-60" />
        <span className="font-light tracking-wide opacity-70">
          Drop photos or videos here, or click to choose
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {queue.length > 0 && (
        <ul className="mt-4 space-y-2">
          {queue.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 text-sm">
              <span className="w-56 truncate font-light">{entry.file.name}</span>
              {entry.status === "error" ? (
                <button
                  type="button"
                  onClick={() => start(entry.file, entry.id)}
                  className="inline-flex items-center gap-1 text-destructive hover:opacity-80"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </button>
              ) : (
                <Progress value={entry.pct} className="h-1.5 flex-1" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
