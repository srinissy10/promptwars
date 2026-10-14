import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import type { AuthMode } from "@/types/api";

export const createAuthSchema = (isRegister: boolean) => z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(256, "Password is too long"),
  confirmPassword: z.string().max(256, "Password is too long"),
}).superRefine((values, context) => {
  if (!isRegister) return;
  if (!values.confirmPassword) {
    context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Confirm your password" });
  } else if (values.password !== values.confirmPassword) {
    context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
  }
});

interface AuthValues {
  email: string;
  password: string;
  confirmPassword: string;
}

interface AuthFormProps {
  mode: AuthMode;
  onSwitch: () => void;
}

export function AuthForm({ mode, onSwitch }: AuthFormProps) {
  const { authenticate } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isRegister = mode === "register";
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AuthValues>({
    resolver: zodResolver(createAuthSchema(isRegister)),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await authenticate(mode, values.email, values.password);
    } catch (error) {
      if (isRegister && error instanceof ApiError && error.status === 409) {
        setError("email", { type: "server", message: "An account with this email already exists" }, { shouldFocus: true });
        return;
      }
      setFormError(getErrorMessage(error));
    }
  });

  return (
    <form className="w-full" onSubmit={onSubmit} noValidate>
      <div className="mb-8">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Secure workspace</div>
        <h1 className="text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-[2.2rem]">
          {isRegister ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {isRegister ? "Set up a private workspace for your documents and conversations." : "Sign in to continue to your document workspace."}
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor={`${mode}-email`}>Work email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id={`${mode}-email`} type="email" autoComplete="email" placeholder="you@company.com" className="h-11 pl-10" aria-invalid={Boolean(errors.email)} {...register("email")} />
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${mode}-password`}>Password</Label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id={`${mode}-password`} type={showPassword ? "text" : "password"} autoComplete={isRegister ? "new-password" : "current-password"} placeholder="At least 8 characters" className="h-11 px-10" aria-invalid={Boolean(errors.password)} {...register("password")} />
            <button type="button" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        {isRegister && (
          <div className="space-y-2">
            <Label htmlFor={`${mode}-confirm-password`}>Confirm password</Label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id={`${mode}-confirm-password`}
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Enter your password again"
                className="h-11 px-10"
                aria-invalid={Boolean(errors.confirmPassword)}
                {...register("confirmPassword")}
              />
              <button type="button" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}>
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
          </div>
        )}

        {formError && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
            {formError}
          </div>
        )}

        <Button className="h-11 w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle className="animate-spin" />}
          {isSubmitting ? (isRegister ? "Creating account…" : "Signing in…") : isRegister ? "Create account" : "Sign in"}
        </Button>
      </div>

      <p className="mt-7 text-center text-sm text-muted-foreground">
        {isRegister ? "Already have an account?" : "New to DocChat?"}{" "}
        <button type="button" className="font-medium text-primary hover:underline" onClick={onSwitch}>
          {isRegister ? "Sign in" : "Create one"}
        </button>
      </p>
    </form>
  );
}
