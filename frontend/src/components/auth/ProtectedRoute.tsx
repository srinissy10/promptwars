import type { ReactNode } from "react";
import { AuthPage } from "@/components/auth/AuthPage";
import { Brand } from "@/components/common/Brand";
import { QueryError } from "@/components/common/QueryError";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token, settingsLoading, settingsError, refetchSettings } = useAuth();
  if (!token) return <AuthPage />;

  if (settingsLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f6f8] px-6" aria-label="Loading workspace">
        <div className="w-full max-w-xs rounded-xl border bg-white p-6 shadow-soft">
          <Brand />
          <div className="mt-7 space-y-3">
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <p className="mt-6 text-xs text-muted-foreground">Opening your workspace…</p>
        </div>
      </main>
    );
  }

  if (settingsError) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f6f8]">
        <QueryError error={settingsError} onRetry={() => void refetchSettings()} />
      </main>
    );
  }

  return children;
}
