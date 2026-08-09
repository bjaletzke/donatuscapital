import { useState } from "react";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { downloadUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { MediaItem } from "../../../shared/types";

const SIZES = [
  { value: "web", label: "Web", hint: "1200 px — social & email" },
  { value: "large", label: "Large", hint: "2560 px — screens & small prints" },
  { value: "original", label: "Original", hint: "Full resolution, as shot" },
] as const;

const FORMATS = [
  { value: "jpeg", label: "JPEG", hint: "Opens everywhere" },
  { value: "webp", label: "WebP", hint: "Smaller files" },
  { value: "avif", label: "AVIF", hint: "Smallest, modern" },
] as const;

interface Props {
  slug: string;
  item: MediaItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function OptionGrid<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: ReadonlyArray<{ value: T; label: string; hint: string }>;
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("grid grid-cols-3 gap-2", disabled && "pointer-events-none opacity-40")}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "border px-3 py-2 text-left transition-colors",
            value === o.value
              ? "border-ink bg-ink text-cream"
              : "border-ink/20 hover:border-ink/50"
          )}
        >
          <span className="block text-sm">{o.label}</span>
          <span className={cn("block text-[11px] leading-tight", value === o.value ? "opacity-70" : "opacity-50")}>
            {o.hint}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function DownloadDialog({ slug, item, open, onOpenChange }: Props) {
  const [size, setSize] = useState<(typeof SIZES)[number]["value"]>("large");
  const [format, setFormat] = useState<(typeof FORMATS)[number]["value"]>("jpeg");
  const isVideo = item.type === "video";
  const isOriginal = isVideo || size === "original";

  const start = () => {
    const url = isVideo
      ? downloadUrl(slug, item.id, "original")
      : downloadUrl(slug, item.id, size, isOriginal ? undefined : format);
    window.location.assign(url);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-light tracking-wide">Download</DialogTitle>
          <DialogDescription>
            {isVideo ? "Videos download at original quality." : "Choose a size and format."}
          </DialogDescription>
        </DialogHeader>
        {!isVideo && (
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label>Size</Label>
              <OptionGrid options={SIZES} value={size} onChange={setSize} />
            </div>
            <div className="space-y-2">
              <Label className={cn(size === "original" && "opacity-40")}>Format</Label>
              <OptionGrid
                options={FORMATS}
                value={format}
                onChange={setFormat}
                disabled={size === "original"}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={start} className="w-full gap-2">
            <Download className="h-4 w-4" />
            {isVideo ? "Download original" : "Download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
