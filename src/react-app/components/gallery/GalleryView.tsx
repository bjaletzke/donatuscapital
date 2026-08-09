import { useMemo, useState } from "react";
import { ArrowDownNarrowWide, ArrowUpNarrowWide, X } from "lucide-react";
import MediaTile from "./MediaTile";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MediaItem } from "../../../shared/types";

interface DayGroup {
  key: string; // "YYYY-MM-DD" or "undated"
  dayNumber: number | null; // 1-based chronological day of the trip
  items: MediaItem[];
}

interface Props {
  media: MediaItem[];
  /** Called with the photo clicked and the full flat list of visible photos, in display order */
  onOpenPhoto: (photos: MediaItem[], index: number) => void;
  renderOverlay?: (item: MediaItem) => React.ReactNode;
}

const dayLabel = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export default function GalleryView({ media, onOpenPhoto, renderOverlay }: Props) {
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [active, setActive] = useState<Set<string>>(new Set());

  const keywords = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of media) {
      for (const k of m.keywords ?? []) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [media]);

  const groups = useMemo<DayGroup[]>(() => {
    const filtered = media.filter((m) =>
      [...active].every((k) => (m.keywords ?? []).includes(k))
    );
    const byDay = new Map<string, MediaItem[]>();
    for (const m of filtered) {
      const key = m.takenAt ? m.takenAt.slice(0, 10) : "undated";
      const list = byDay.get(key) ?? [];
      list.push(m);
      byDay.set(key, list);
    }
    // Day numbers come from the FULL project timeline so "Day 3" is stable
    // even when filters hide other days.
    const allDays = [...new Set(
      media.filter((m) => m.takenAt).map((m) => m.takenAt!.slice(0, 10))
    )].sort();
    const dayNumber = new Map(allDays.map((d, i) => [d, i + 1]));

    const dated = [...byDay.keys()]
      .filter((k) => k !== "undated")
      .sort((a, b) => (sort === "asc" ? a.localeCompare(b) : b.localeCompare(a)));
    const ordered = byDay.has("undated") ? [...dated, "undated"] : dated;

    return ordered.map((key) => ({
      key,
      dayNumber: key === "undated" ? null : (dayNumber.get(key) ?? null),
      items: (byDay.get(key) ?? []).sort((a, b) =>
        (a.takenAt ?? "").localeCompare(b.takenAt ?? "")
      ),
    }));
  }, [media, active, sort]);

  const visiblePhotos = useMemo(
    () => groups.flatMap((g) => g.items).filter((m) => m.type === "photo"),
    [groups]
  );

  const hasDays = groups.some((g) => g.dayNumber !== null);
  const toggle = (k: string) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <div>
      {(keywords.length > 0 || hasDays) && (
        <div className="mb-10 flex flex-wrap items-center gap-2">
          {hasDays && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSort((s) => (s === "asc" ? "desc" : "asc"))}
              className="mr-2 gap-2 font-mono text-xs uppercase tracking-wider"
            >
              {sort === "asc" ? (
                <ArrowDownNarrowWide className="h-3.5 w-3.5" />
              ) : (
                <ArrowUpNarrowWide className="h-3.5 w-3.5" />
              )}
              {sort === "asc" ? "Oldest first" : "Newest first"}
            </Button>
          )}
          {keywords.map(([k, count]) => (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              className={cn(
                "border px-3 py-1 text-xs tracking-wide transition-colors",
                active.has(k)
                  ? "border-ink bg-ink text-cream"
                  : "border-ink/20 opacity-70 hover:border-ink/50 hover:opacity-100"
              )}
            >
              {k} <span className="opacity-50">{count}</span>
            </button>
          ))}
          {active.size > 0 && (
            <button
              type="button"
              onClick={() => setActive(new Set())}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs opacity-60 hover:opacity-100"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      )}

      {groups.length === 0 && (
        <p className="text-sm font-light opacity-60">Nothing matches this selection.</p>
      )}

      {groups.map((group) => (
        <section key={group.key} className="mb-12">
          {hasDays && (
            <header className="mb-5 flex items-baseline gap-3 border-b border-ink/10 pb-2">
              {group.dayNumber !== null ? (
                <>
                  <span className="font-mono text-xs uppercase tracking-[0.2em] opacity-50">
                    Day {String(group.dayNumber).padStart(2, "0")}
                  </span>
                  <h2 className="font-serif text-lg font-light tracking-wide">
                    {dayLabel(group.key)}
                  </h2>
                </>
              ) : (
                <span className="font-mono text-xs uppercase tracking-[0.2em] opacity-50">
                  Undated
                </span>
              )}
              <span className="ml-auto font-mono text-xs opacity-40">
                {group.items.length}
              </span>
            </header>
          )}
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {group.items.map((item) => (
              <MediaTile
                key={item.id}
                item={item}
                onOpen={
                  item.type === "photo"
                    ? () =>
                        onOpenPhoto(
                          visiblePhotos,
                          visiblePhotos.findIndex((p) => p.id === item.id)
                        )
                    : undefined
                }
                overlay={renderOverlay?.(item)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
