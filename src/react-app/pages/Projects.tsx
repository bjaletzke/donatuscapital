import { useEffect, useState } from "react";
import { Link } from "react-router";
import InvestorHeader from "@/components/InvestorHeader";
import NewProjectDialog from "@/components/admin/NewProjectDialog";
import { api, variantUrl } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { ProjectIndexEntry } from "../../shared/types";

export default function Projects() {
  const { role } = useSession();
  const [projects, setProjects] = useState<ProjectIndexEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ProjectIndexEntry[]>("/api/projects")
      .then(setProjects)
      .catch(() => setError("Could not load projects."));
  }, []);

  return (
    <div className="min-h-screen bg-cream text-ink">
      <InvestorHeader />
      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-10 flex items-center justify-between">
          <h1 className="text-2xl font-light tracking-wide">Projects</h1>
          {role === "admin" && <NewProjectDialog />}
        </div>
        {error && <p className="text-sm opacity-70">{error}</p>}
        {projects && projects.length === 0 && (
          <p className="text-sm font-light opacity-60">No projects yet.</p>
        )}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {projects?.map((p) => (
            <Link
              key={p.slug}
              to={`/investor/projects/${p.slug}`}
              className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
            >
              <div className="aspect-[4/3] overflow-hidden bg-ink/5">
                {p.cover ? (
                  <img
                    src={variantUrl(p.cover, 800)}
                    alt={p.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-[0.2em] opacity-40">
                    No cover
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <h2 className="text-lg font-light tracking-wide">{p.title}</h2>
                <span className="text-xs tracking-[0.15em] opacity-50">{p.date}</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
