import { variantUrl, rawUrl } from "@/lib/api";
import type { MediaItem } from "../../../shared/types";

interface Props {
  item: MediaItem;
  onOpen?: () => void;
  /** Extra controls rendered over the tile (admin edit mode, download button) */
  overlay?: React.ReactNode;
}

export default function MediaTile({ item, onOpen, overlay }: Props) {
  const ratio = item.width > 0 && item.height > 0 ? item.width / item.height : 3 / 2;

  return (
    <figure className="group relative mb-4 break-inside-avoid">
      {item.type === "photo" ? (
        <button
          type="button"
          onClick={onOpen}
          className="block w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
          style={{ aspectRatio: ratio }}
        >
          <img
            src={variantUrl(item.key, 800)}
            alt={item.caption ?? item.filename}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </button>
      ) : (
        <video
          controls
          preload="metadata"
          src={rawUrl(item.key)}
          className="w-full"
          style={{ aspectRatio: ratio }}
        />
      )}
      {item.caption && (
        <figcaption className="mt-1.5 text-xs font-light tracking-wide opacity-60">
          {item.caption}
        </figcaption>
      )}
      {overlay}
    </figure>
  );
}
