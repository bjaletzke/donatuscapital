import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowDown, ArrowLeft, ArrowUp, Download, ImageIcon, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import InvestorHeader from "@/components/InvestorHeader";
import MediaTile from "@/components/gallery/MediaTile";
import Lightbox from "@/components/gallery/Lightbox";
import DownloadDialog from "@/components/gallery/DownloadDialog";
import UploadZone from "@/components/admin/UploadZone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, variantUrl } from "@/lib/api";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { MediaItem, ProjectManifest } from "../../shared/types";

interface Draft {
  title: string;
  description: string;
  date: string;
  cover?: string;
  media: MediaItem[];
}

export default function ProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const { role } = useSession();
  const navigate = useNavigate();
  const [manifest, setManifest] = useState<ProjectManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [downloadItem, setDownloadItem] = useState<MediaItem | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  const reload = useCallback(() => {
    if (!slug) return;
    api<ProjectManifest>(`/api/projects/${slug}`)
      .then(setManifest)
      .catch(() => setError("Could not load this project."));
  }, [slug]);

  useEffect(reload, [reload]);

  const editing = draft !== null;
  const photos = manifest?.media.filter((m) => m.type === "photo") ?? [];

  const startEdit = () => {
    if (!manifest) return;
    setDraft({
      title: manifest.title,
      description: manifest.description,
      date: manifest.date,
      cover: manifest.cover,
      media: [...manifest.media],
    });
  };

  const save = async () => {
    if (!slug || !draft || saving) return;
    setSaving(true);
    try {
      const updated = await api<ProjectManifest>(`/api/projects/${slug}`, {
        method: "PUT",
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          date: draft.date,
          cover: draft.cover ?? null,
          media: draft.media.map((m) => ({ id: m.id, caption: m.caption ?? "" })),
        }),
      });
      setManifest(updated);
      setDraft(null);
      toast.success("Saved");
    } catch {
      toast.error("Could not save changes");
    } finally {
      setSaving(false);
    }
  };

  const move = (index: number, delta: -1 | 1) => {
    setDraft((d) => {
      if (!d) return d;
      const next = [...d.media];
      const j = index + delta;
      if (j < 0 || j >= next.length) return d;
      [next[index], next[j]] = [next[j], next[index]];
      return { ...d, media: next };
    });
  };

  const deleteItem = async (item: MediaItem) => {
    if (!slug) return;
    try {
      await api(`/api/projects/${slug}/media/${item.id}`, { method: "DELETE" });
      setDraft((d) =>
        d
          ? {
              ...d,
              media: d.media.filter((m) => m.id !== item.id),
              cover: d.cover === item.id ? undefined : d.cover,
            }
          : d
      );
      setManifest((m) =>
        m ? { ...m, media: m.media.filter((x) => x.id !== item.id) } : m
      );
      toast.success("Deleted");
    } catch {
      toast.error("Could not delete");
    }
  };

  const deleteProject = async () => {
    if (!slug || deleteText !== slug) return;
    try {
      await api(`/api/projects/${slug}`, { method: "DELETE" });
      navigate("/investor/projects", { replace: true });
    } catch {
      toast.error("Could not delete project");
    }
  };

  return (
    <div className="min-h-screen bg-cream text-ink">
      <InvestorHeader />
      <main className="mx-auto max-w-7xl px-6 py-12 pb-28">
        <div className="mb-8 flex items-center justify-between">
          <Link
            to="/investor/projects"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] opacity-60 hover:opacity-90"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All projects
          </Link>
          {role === "admin" && !editing && manifest && (
            <Button variant="outline" size="sm" onClick={startEdit} className="gap-2">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </div>
        {error && <p className="text-sm opacity-70">{error}</p>}
        {manifest && (
          <>
            <div className="mb-12 max-w-2xl">
              {editing && draft ? (
                <div className="space-y-3">
                  <Input
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    className="text-xl"
                    aria-label="Title"
                  />
                  <Input
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="Description"
                    aria-label="Description"
                  />
                  <Input
                    value={draft.date}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                    placeholder="Date"
                    aria-label="Date"
                    className="max-w-40"
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-4">
                    <h1 className="text-3xl font-light tracking-wide">{manifest.title}</h1>
                    <span className="text-sm tracking-[0.15em] opacity-50">{manifest.date}</span>
                  </div>
                  {manifest.description && (
                    <p className="mt-4 font-light leading-relaxed opacity-80">
                      {manifest.description}
                    </p>
                  )}
                </>
              )}
            </div>

            {role === "admin" && !editing && slug && (
              <UploadZone
                slug={slug}
                onUploaded={(item) =>
                  setManifest((m) => (m ? { ...m, media: [...m.media, item] } : m))
                }
              />
            )}

            {manifest.media.length === 0 && !editing && (
              <p className="text-sm font-light opacity-60">Nothing here yet.</p>
            )}

            {editing && draft ? (
              <ul className="space-y-3">
                {draft.media.map((item, i) => (
                  <li key={item.id} className="flex items-center gap-4 border border-ink/10 bg-white/60 p-3">
                    <img
                      src={variantUrl(item.key, 200)}
                      alt=""
                      className="h-16 w-20 shrink-0 object-cover"
                    />
                    <Input
                      value={item.caption ?? ""}
                      placeholder="Caption"
                      onChange={(e) =>
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                media: d.media.map((m) =>
                                  m.id === item.id ? { ...m, caption: e.target.value } : m
                                ),
                              }
                            : d
                        )
                      }
                      className="flex-1"
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
                        onClick={() => setDraft({ ...draft, cover: item.id })}
                        aria-label="Set as cover"
                        className={cn(item.type !== "photo" && "invisible", draft.cover === item.id && "bg-ink text-cream hover:bg-ink hover:text-cream")}
                      >
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteItem(item)} aria-label="Delete" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
                <li className="pt-6">
                  <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/5">
                    <Trash2 className="h-3.5 w-3.5" /> Delete project
                  </Button>
                </li>
              </ul>
            ) : (
              <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
                {manifest.media.map((item) => (
                  <MediaTile
                    key={item.id}
                    item={item}
                    onOpen={
                      item.type === "photo"
                        ? () => setLightbox(photos.findIndex((p) => p.id === item.id))
                        : undefined
                    }
                    overlay={
                      <button
                        type="button"
                        aria-label="Download"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDownloadItem(item);
                        }}
                        className="absolute right-2 top-2 bg-ink/70 p-2 text-cream opacity-0 transition-opacity hover:bg-ink group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}

        {editing && (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-cream/95 backdrop-blur-sm">
            <div className="mx-auto flex max-w-7xl items-center justify-end gap-3 px-6 py-3">
              <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
                Discard
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        )}

        {lightbox !== null && manifest && (
          <Lightbox
            photos={photos}
            index={lightbox}
            onClose={() => setLightbox(null)}
            onNavigate={setLightbox}
            action={
              <button
                type="button"
                aria-label="Download"
                onClick={() => setDownloadItem(photos[lightbox])}
                className="p-2 opacity-70 transition-opacity hover:opacity-100"
              >
                <Download className="h-5 w-5" />
              </button>
            }
          />
        )}
        {downloadItem && slug && (
          <DownloadDialog
            slug={slug}
            item={downloadItem}
            open
            onOpenChange={(open) => {
              if (!open) setDownloadItem(null);
            }}
          />
        )}
        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-light tracking-wide">Delete project</DialogTitle>
              <DialogDescription>
                This permanently removes the project and every photo and video in it. Type{" "}
                <span className="font-mono">{slug}</span> to confirm.
              </DialogDescription>
            </DialogHeader>
            <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder={slug} />
            <DialogFooter>
              <Button
                variant="destructive"
                onClick={deleteProject}
                disabled={deleteText !== slug}
                className="w-full"
              >
                Delete forever
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
