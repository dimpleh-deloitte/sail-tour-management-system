import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiClientError } from "../api/client.js";
import { Employee } from "../types.js";

interface SessionContextValue {
  user: Employee | null;
  loading: boolean;
  devLogin: (personNumber: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<Employee>("/me");
      setUser(me);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setUser(null);
      } else {
        throw err;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const devLogin = useCallback(async (personNumber: string) => {
    const employee = await api.post<Employee>("/auth/dev-login", { personNumber });
    setUser(employee);
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
  }, []);

  return (
    <SessionContext.Provider value={{ user, loading, devLogin, logout, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
