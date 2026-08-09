import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { api } from "./api";
import type { Role } from "../../shared/types";

interface Session {
  role: Role | null;
  loading: boolean;
  login: (phrase: string) => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ role: Role }>("/api/auth/me")
      .then((r) => setRole(r.role))
      .catch(() => setRole(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (phrase: string) => {
    const r = await api<{ role: Role }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ phrase }),
    });
    setRole(r.role);
  };

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    setRole(null);
  };

  return (
    <SessionContext.Provider value={{ role, loading, login, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

export function RequireSession({ children }: { children: ReactNode }) {
  const { role, loading } = useSession();
  const location = useLocation();
  if (loading) return null;
  if (!role) return <Navigate to="/investor" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
