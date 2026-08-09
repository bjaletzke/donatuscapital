import { useState } from "react";
import { ArrowDown, ArrowUp, ImageIcon, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { variantUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { MediaItem } from "../../../shared/types";

export interface Draft {
  title: string;
  description: string;
  date: string;
  cover?: string;
  media: MediaItem[];
}

interface Props {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft | null>>;
  onDeleteItem: (item: MediaItem) => void;
  onDeleteProject: () => void;
}

const parseKeywords = (s: string) =>
  s
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

export default function EditList({ draft, setDraft, onDeleteItem, onDeleteProject }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState("");

  const patchItem = (id: string, patch: Partial<MediaItem>) =>
    setDraft((d) =>
      d ? { ...d, media: d.media.map((m) => (m.id === id ? { ...m, ...patch } : m)) } : d
    );

  const move = (index: number, delta: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const next = [...d.media];
      const j = index + delta;
      if (j < 0 || j >= next.length) return d;
      [next[index], next[j]] = [next[j], next[index]];
      return { ...d, media: next };
    });

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const applyBulk = () => {
    const add = parseKeywords(bulk);
    if (add.length === 0 || selected.size === 0) return;
    setDraft((d) =>
      d
        ? {
            ...d,
            media: d.media.map((m) =>
              selected.has(m.id)
                ? {
                    ...m,
                    keywords: [
                      ...(m.keywords ?? []),
                      ...add.filter(
                        (k) =>
                          !(m.keywords ?? []).some(
                            (existing) => existing.toLowerCase() === k.toLowerCase()
                          )
                      ),
                    ],
                  }
                : m
            ),
          }
        : d
    );
    setBulk("");
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 border border-ink/10 bg-white/60 p-3">
        <label className="flex items-center gap-2 text-xs opacity-70">
          <input
            type="checkbox"
            checked={selected.size === draft.media.length && draft.media.length > 0}
            onChange={(e) =>
              setSelected(e.target.checked ? new Set(draft.media.map((m) => m.id)) : new Set())
            }
          />
          {selected.size > 0 ? `${selected.size} selected` : "Select all"}
        </label>
        <Input
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyBulk();
          }}
          placeholder="Add keywords / album to selected (comma separated)"
          className="max-w-md flex-1"
          disabled={selected.size === 0}
        />
        <Button size="sm" variant="outline" onClick={applyBulk} disabled={selected.size === 0 || !bulk.trim()} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Apply
        </Button>
      </div>

      <ul className="space-y-3">
        {draft.media.map((item, i) => (
          <li key={item.id} className="flex flex-wrap items-center gap-3 border border-ink/10 bg-white/60 p-3">
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={() => toggleSelect(item.id)}
              aria-label={`Select ${item.filename}`}
            />
            <img src={variantUrl(item.key, 200)} alt="" className="h-16 w-20 shrink-0 object-cover" />
            <div className="flex min-w-64 flex-1 flex-col gap-2">
              <Input
                value={item.caption ?? ""}
                placeholder="Caption"
                onChange={(e) => patchItem(item.id, { caption: e.target.value })}
              />
              <Input
                value={(item.keywords ?? []).join(", ")}
                placeholder="Keywords / albums (comma separated)"
                onChange={(e) => patchItem(item.id, { keywords: parseKeywords(e.target.value) })}
                className="font-mono text-xs"
              />
            </div>
            <Input
              type="date"
              value={item.takenAt ? item.takenAt.slice(0, 10) : ""}
              onChange={(e) =>
                patchItem(item.id, {
                  takenAt: e.target.value ? `${e.target.value}T12:00:00.000Z` : undefined,
                })
              }
              className="w-38 font-mono text-xs"
              aria-label="Capture date"
            />
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === draft.media.length - 1} aria-label="Move down">
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDraft((d) => (d ? { ...d, cover: item.id } : d))}
                aria-label="Set as cover"
                className={cn(
                  item.type !== "photo" && "invisible",
                  draft.cover === item.id && "bg-ink text-cream hover:bg-ink hover:text-cream"
                )}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDeleteItem(item)} aria-label="Delete" className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="pt-8">
        <Button
          variant="outline"
          size="sm"
          onClick={onDeleteProject}
          className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/5"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete project
        </Button>
      </div>
    </div>
  );
}
