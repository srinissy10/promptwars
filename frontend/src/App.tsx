import { Toaster } from "sonner";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Workspace } from "@/components/layout/Workspace";

export default function App() {
  return (
    <ProtectedRoute>
      <Workspace />
      <Toaster richColors closeButton position="bottom-right" toastOptions={{ className: "text-sm" }} />
    </ProtectedRoute>
  );
}
