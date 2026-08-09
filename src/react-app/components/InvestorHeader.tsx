import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";

export default function InvestorHeader() {
  const { role, logout } = useSession();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/investor", { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-cream/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link
          to="/investor/projects"
          className="text-sm font-normal uppercase tracking-[0.2em] opacity-80 hover:opacity-100"
        >
          Donatus Capital
        </Link>
        <div className="flex items-center gap-3">
          {role === "admin" && (
            <span className="border border-ink/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] opacity-60">
              Admin
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={onLogout} className="tracking-wide">
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
