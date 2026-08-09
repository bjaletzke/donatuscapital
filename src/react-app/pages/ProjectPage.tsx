import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import InvestorHeader from "@/components/InvestorHeader";
import MediaTile from "@/components/gallery/MediaTile";
import Lightbox from "@/components/gallery/Lightbox";
import { api } from "@/lib/api";
import type { ProjectManifest } from "../../shared/types";

export default function ProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const [manifest, setManifest] = useState<ProjectManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const reload = useCallback(() => {
    if (!slug) return;
    api<ProjectManifest>(`/api/projects/${slug}`)
      .then(setManifest)
      .catch(() => setError("Could not load this project."));
  }, [slug]);

  useEffect(reload, [reload]);

  const photos = manifest?.media.filter((m) => m.type === "photo") ?? [];

  return (
    <div className="min-h-screen bg-cream text-ink">
      <InvestorHeader />
      <main className="mx-auto max-w-7xl px-6 py-12">
        <Link
          to="/investor/projects"
          className="mb-8 inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] opacity-60 hover:opacity-90"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All projects
        </Link>
        {error && <p className="text-sm opacity-70">{error}</p>}
        {manifest && (
          <>
            <div className="mb-12 max-w-2xl">
              <div className="flex items-baseline gap-4">
                <h1 className="text-3xl font-light tracking-wide">{manifest.title}</h1>
                <span className="text-sm tracking-[0.15em] opacity-50">{manifest.date}</span>
              </div>
              {manifest.description && (
                <p className="mt-4 font-light leading-relaxed opacity-80">
                  {manifest.description}
                </p>
              )}
            </div>
            {manifest.media.length === 0 && (
              <p className="text-sm font-light opacity-60">Nothing here yet.</p>
            )}
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
                />
              ))}
            </div>
          </>
        )}
        {lightbox !== null && manifest && (
          <Lightbox
            photos={photos}
            index={lightbox}
            onClose={() => setLightbox(null)}
            onNavigate={setLightbox}
          />
        )}
      </main>
    </div>
  );
}
