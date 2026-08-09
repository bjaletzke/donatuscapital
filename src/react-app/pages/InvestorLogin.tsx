import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";

export default function InvestorLogin() {
  const { role, login } = useSession();
  const navigate = useNavigate();
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (role) {
    navigate("/investor/projects", { replace: true });
    return null;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!phrase || pending) return;
    setPending(true);
    setError(null);
    try {
      await login(phrase);
      navigate("/investor/projects", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("Too many attempts — try again in a minute.");
      } else {
        setError("Incorrect passphrase.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="dark min-h-screen bg-ink text-cream flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <a href="/" className="block mb-10 text-center text-sm tracking-[0.2em] uppercase opacity-60 hover:opacity-90 transition-opacity">
          Donatus Capital
        </a>
        <div className="border border-cream/15 bg-cream/[0.03] p-8">
          <h1 className="text-xl font-light tracking-wide mb-1">Investor Access</h1>
          <p className="text-sm opacity-60 mb-6 font-light">
            This area is reserved for authorized parties.
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phrase" className="text-cream/80">
                Access phrase
              </Label>
              <Input
                id="phrase"
                type="password"
                autoFocus
                autoComplete="current-password"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                className="bg-ink border-cream/25 text-cream"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button
              type="submit"
              disabled={pending || !phrase}
              className="w-full bg-cream text-ink hover:bg-cream/90"
            >
              {pending ? "Verifying…" : "Enter"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
