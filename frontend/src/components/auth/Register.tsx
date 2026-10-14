import { AuthForm } from "@/components/auth/AuthForm";

export function Register({ onLogin }: { onLogin: () => void }) {
  return <AuthForm mode="register" onSwitch={onLogin} />;
}
