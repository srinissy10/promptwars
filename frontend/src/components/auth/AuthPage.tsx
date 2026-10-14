import { CheckCircle2, Database, LockKeyhole, Quote } from "lucide-react";
import { useState } from "react";

import { Login } from "@/components/auth/Login";
import { Register } from "@/components/auth/Register";
import { Brand } from "@/components/common/Brand";
import type { AuthMode } from "@/types/api";

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");

  return (
    <main className="min-h-screen bg-[#f5f6f8] p-3 sm:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1480px] overflow-hidden rounded-2xl border bg-white shadow-soft sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1.08fr_.92fr]">
        <section className="relative hidden overflow-hidden bg-[#101827] p-10 text-white lg:flex lg:flex-col xl:p-14">
          <div className="absolute -right-28 top-24 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute -right-12 top-40 h-52 w-52 rounded-full border border-white/10" />
          <Brand inverse className="relative z-10" />

          <div className="relative z-10 my-auto max-w-2xl py-16">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Grounded document intelligence
            </div>
            <h2 className="max-w-xl text-5xl font-semibold leading-[1.05] tracking-[-0.05em] xl:text-6xl">
              Answers your team can verify.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">
              Turn dense PDFs, documents, and notes into focused conversations—every response grounded in passages you can inspect.
            </p>

            <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
              {[
                [LockKeyhole, "Private", "Files stay local"],
                [Quote, "Traceable", "Source-backed answers"],
                [Database, "Persistent", "Saved conversations"],
              ].map(([Icon, title, copy]) => {
                const FeatureIcon = Icon as typeof LockKeyhole;
                return (
                  <div key={String(title)} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
                    <FeatureIcon className="mb-4 h-4 w-4 text-slate-300" />
                    <div className="text-sm font-medium">{String(title)}</div>
                    <div className="mt-1 text-xs text-slate-400">{String(copy)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Secure local workspace · No document text in logs
          </div>
        </section>

        <section className="flex min-h-[640px] flex-col">
          <div className="p-6 lg:hidden"><Brand /></div>
          <div className="flex flex-1 items-center justify-center px-6 pb-10 sm:px-12">
            <div className="w-full max-w-[420px]">
              {mode === "login" ? <Login onRegister={() => setMode("register")} /> : <Register onLogin={() => setMode("login")} />}
            </div>
          </div>
          <p className="px-6 pb-6 text-center text-[11px] text-muted-foreground">DocChat local workspace · Your account data stays on this machine</p>
        </section>
      </div>
    </main>
  );
}
