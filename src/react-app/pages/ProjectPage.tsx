import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Download, Pencil } from "lucide-react";
import { toast } from "sonner";
import InvestorHeader from "@/components/InvestorHeader";
import GalleryView from "@/components/gallery/GalleryView";
import Lightbox from "@/components/gallery/Lightbox";
import DownloadDialog from "@/components/gallery/DownloadDialog";
import UploadZone from "@/components/admin/UploadZone";
import EditList, { type Draft } from "@/components/admin/EditList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { MediaItem, ProjectManifest } from "../../shared/types";

export default function ProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const { role } = useSession();
  const navigate = useNavigate();
  const [manifest, setManifest] = useState<ProjectManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: MediaItem[]; index: number } | null>(null);
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

  const startEdit = () => {
    if (!manifest) return;
    setDraft({
      title: manifest.title,
      description: manifest.description,
      date: manifest.date,
      cover: manifest.cover,
      media: manifest.media.map((m) => ({ ...m })),
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
          media: draft.media.map((m) => ({
            id: m.id,
            caption: m.caption ?? "",
            takenAt: m.takenAt ?? null,
            keywords: m.keywords ?? [],
          })),
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

  const deleteItem = async (item: MediaItem) => {
    if (!slug) return;
    try {
      await api(`/api/projects/${slug}/media/${item.id}`, { method: "DELETE" });
      const strip = <T extends { media: MediaItem[]; cover?: string }>(x: T): T => ({
        ...x,
        media: x.media.filter((m) => m.id !== item.id),
        cover: x.cover === item.id ? undefined : x.cover,
      });
      setDraft((d) => (d ? strip(d) : d));
      setManifest((m) => (m ? strip(m) : m));
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
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] opacity-60 hover:opacity-90"
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
                  <Textarea
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="Description — shown under the title and on the project card"
                    aria-label="Description"
                    rows={3}
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
                    <h1 className="font-serif text-3xl font-light tracking-wide">
                      {manifest.title}
                    </h1>
                    <span className="font-mono text-sm tracking-[0.15em] opacity-50">
                      {manifest.date}
                    </span>
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
              <EditList
                draft={draft}
                setDraft={setDraft}
                onDeleteItem={deleteItem}
                onDeleteProject={() => setConfirmDelete(true)}
              />
            ) : (
              <GalleryView
                media={manifest.media}
                onOpenPhoto={(photos, index) => setLightbox({ photos, index })}
                renderOverlay={(item) => (
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
                )}
              />
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

        {lightbox !== null && (
          <Lightbox
            photos={lightbox.photos}
            index={lightbox.index}
            onClose={() => setLightbox(null)}
            onNavigate={(index) => setLightbox((l) => (l ? { ...l, index } : l))}
            action={
              <button
                type="button"
                aria-label="Download"
                onClick={() => setDownloadItem(lightbox.photos[lightbox.index])}
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
