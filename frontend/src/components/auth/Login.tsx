import { AuthForm } from "@/components/auth/AuthForm";

export function Login({ onRegister }: { onRegister: () => void }) {
  return <AuthForm mode="login" onSwitch={onRegister} />;
}
