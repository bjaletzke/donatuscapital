import { useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { variantUrl } from "@/lib/api";
import type { MediaItem } from "../../../shared/types";

interface Props {
  photos: MediaItem[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  /** Extra action button (download) rendered in the top bar */
  action?: React.ReactNode;
}

export default function Lightbox({ photos, index, onClose, onNavigate, action }: Props) {
  const photo = photos[index];

  const prev = useCallback(
    () => onNavigate((index - 1 + photos.length) % photos.length),
    [index, photos.length, onNavigate]
  );
  const next = useCallback(
    () => onNavigate((index + 1) % photos.length),
    [index, photos.length, onNavigate]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/95 text-cream" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs tracking-[0.15em] uppercase opacity-50">
          {index + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-2">
          {action}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
        {photos.length > 1 && (
          <button
            type="button"
            onClick={prev}
            aria-label="Previous"
            className="absolute left-2 z-10 p-3 opacity-60 transition-opacity hover:opacity-100"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        )}
        <figure className="flex h-full min-h-0 flex-col items-center justify-center">
          <img
            src={variantUrl(photo.key, 2048)}
            alt={photo.caption ?? photo.filename}
            className="min-h-0 max-h-full max-w-full object-contain"
          />
          {(photo.caption || (photo.keywords?.length ?? 0) > 0) && (
            <figcaption className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              {photo.caption && (
                <span className="text-sm font-light tracking-wide opacity-70">{photo.caption}</span>
              )}
              {photo.keywords?.map((k) => (
                <span key={k} className="font-mono text-[11px] uppercase tracking-wider opacity-40">
                  {k}
                </span>
              ))}
            </figcaption>
          )}
        </figure>
        {photos.length > 1 && (
          <button
            type="button"
            onClick={next}
            aria-label="Next"
            className="absolute right-2 z-10 p-3 opacity-60 transition-opacity hover:opacity-100"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        )}
      </div>
    </div>
  );
}
