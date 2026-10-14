import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ApiClient } from "@/lib/api";
import { sessionStorage } from "@/lib/storage";
import type { Settings } from "@/types/api";

interface AuthContextValue {
  token: string | null;
  settings: Settings | undefined;
  settingsLoading: boolean;
  settingsError: unknown;
  api: ApiClient;
  authenticate: (mode: "login" | "register", email: string, password: string) => Promise<void>;
  logout: (expired?: boolean) => void;
  refetchSettings: () => Promise<unknown>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(() => sessionStorage.getToken());

  const logout = useCallback(
    (expired = false) => {
      sessionStorage.clearToken();
      setToken(null);
      queryClient.clear();
      if (expired) toast.error("Your session expired", { description: "Sign in again to continue." });
    },
    [queryClient],
  );

  const api = useMemo(() => new ApiClient(sessionStorage.getToken, () => logout(true)), [logout]);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    enabled: Boolean(token),
    retry: 1,
    staleTime: 30_000,
  });

  const authenticate = useCallback(
    async (mode: "login" | "register", email: string, password: string) => {
      const result = await api.authenticate(mode, email, password);
      sessionStorage.setToken(result.access_token);
      setToken(result.access_token);
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    [api, queryClient],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      settings: settingsQuery.data,
      settingsLoading: settingsQuery.isLoading,
      settingsError: settingsQuery.error,
      api,
      authenticate,
      logout,
      refetchSettings: settingsQuery.refetch,
    }),
    [api, authenticate, logout, settingsQuery.data, settingsQuery.error, settingsQuery.isLoading, settingsQuery.refetch, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
