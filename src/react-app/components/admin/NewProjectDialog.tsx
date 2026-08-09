import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import type { ProjectManifest } from "../../../shared/types";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

export default function NewProjectDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(title);
  const slugValid = SLUG_RE.test(effectiveSlug);

  const create = async () => {
    if (!title.trim() || !slugValid || pending) return;
    setPending(true);
    setError(null);
    try {
      const manifest = await api<ProjectManifest>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ slug: effectiveSlug, title, description, date }),
      });
      setOpen(false);
      navigate(`/investor/projects/${manifest.slug}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create project.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> New project
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-light tracking-wide">New project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="np-title">Title</Label>
            <Input
              id="np-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kenya 2026"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="np-slug">Slug</Label>
            <Input
              id="np-slug"
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="kenya-2026"
            />
            {!slugValid && effectiveSlug && (
              <p className="text-xs text-destructive">
                Lowercase letters, digits and dashes only.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="np-desc">Description</Label>
            <Input
              id="np-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="np-date">Date</Label>
            <Input
              id="np-date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="2026"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={!title.trim() || !slugValid || pending} className="w-full">
            {pending ? "Creating…" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
