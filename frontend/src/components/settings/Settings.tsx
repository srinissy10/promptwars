import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/utils";

const apiKeySchema = z.object({ apiKey: z.string().trim().min(20, "Enter a valid API key").max(512) });
type ApiKeyValues = z.infer<typeof apiKeySchema>;

export function Settings({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { settings, api, logout, refetchSettings } = useAuth();
  const [showKey, setShowKey] = useState(false);
  const [clearing, setClearing] = useState(false);
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ApiKeyValues>({ resolver: zodResolver(apiKeySchema), defaultValues: { apiKey: "" } });

  const onSave = handleSubmit(async ({ apiKey }) => {
    try {
      await api.updateApiKey(apiKey);
      await refetchSettings();
      reset();
      toast.success("API key saved", { description: "The key is stored locally and applied immediately." });
    } catch (error) {
      toast.error("Couldn’t save API key", { description: getErrorMessage(error) });
    }
  });

  async function clearKey() {
    setClearing(true);
    try {
      await api.clearApiKey();
      await refetchSettings();
      reset();
      toast.success("API key removed");
    } catch (error) {
      toast.error("Couldn’t remove API key", { description: getErrorMessage(error) });
    } finally {
      setClearing(false);
    }
  }

  if (!settings) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto p-0">
        <DialogHeader className="border-b px-6 py-5 pr-12">
          <DialogTitle>Workspace settings</DialogTitle>
          <DialogDescription>Manage your local model connection and account session.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6 pb-6">
          <section className="pt-1">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">OpenAI connection</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Used for document embeddings and grounded answers.</p>
              </div>
              <Badge variant={settings.openai_configured ? "success" : "warning"} className="gap-1.5 border-0">
                {settings.openai_configured ? <CheckCircle2 className="h-3 w-3" /> : <KeyRound className="h-3 w-3" />}
                {settings.openai_configured ? "Configured" : "Not configured"}
              </Badge>
            </div>

            <form className="rounded-lg border bg-slate-50/70 p-4" onSubmit={onSave}>
              <Label htmlFor="api-key" className="text-xs">API key</Label>
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">The saved value is never returned to the browser.</p>
              <div className="mt-3 flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Input id="api-key" type={showKey ? "text" : "password"} autoComplete="new-password" spellCheck={false} placeholder="Paste a new API key" className="h-9 pr-9 text-xs" {...register("apiKey")} />
                  <button type="button" className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? "Hide API key" : "Show API key"}>{showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                </div>
                <Button size="sm" className="h-9" disabled={isSubmitting}>{isSubmitting && <LoaderCircle className="animate-spin" />}Save key</Button>
              </div>
              {errors.apiKey && <p className="mt-2 text-[10px] text-destructive">{errors.apiKey.message}</p>}
              {settings.openai_configured && (
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button type="button" variant="ghost" size="sm" className="mt-2 h-7 px-2 text-[10px] text-destructive hover:bg-red-50 hover:text-destructive"><Trash2 className="h-3 w-3" /> Remove saved key</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Remove the saved API key?</AlertDialogTitle><AlertDialogDescription>OpenAI-powered embeddings and answers will be unavailable until a new key is saved. Local extractive fallback may still be used.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void clearKey()} disabled={clearing}>{clearing ? "Removing…" : "Remove key"}</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </form>
          </section>

          <Separator />

          <section>
            <p className="mb-3 text-xs font-semibold">Configuration</p>
            <dl className="overflow-hidden rounded-lg border text-[11px]">
              {[
                ["Signed in as", settings.user.email],
                ["Chat provider", settings.provider],
                ["Default model", settings.chat_model],
                ["Embedding model", `${settings.embedding_model} · ${settings.embedding_dimensions} dimensions`],
                ["Upload policy", `${settings.allowed_extensions.join(", ")} · ${settings.max_file_mb} MB max`],
              ].map(([label, value], index) => (
                <div key={label} className={`flex items-center justify-between gap-5 px-3 py-2.5 ${index ? "border-t" : ""}`}>
                  <dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 truncate text-right font-medium text-slate-700" title={value}>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="flex items-center justify-between rounded-lg border bg-slate-50/70 p-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-white text-emerald-600 shadow-sm"><ShieldCheck className="h-4 w-4" /></div>
              <div><p className="text-[11px] font-medium">Local workspace</p><p className="mt-0.5 text-[9px] text-muted-foreground">Files and account data remain on this machine.</p></div>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => logout(false)}><LogOut className="h-3.5 w-3.5" /> Sign out</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
