import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar al panel", robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-12">
      <p className="text-center text-sm text-muted">Panel del negocio</p>
      <h1 className="mt-2 text-center font-display text-5xl tracking-wide">
        <span className="neon-text-purple">
          Agendapp
        </span>
      </h1>
      <LoginForm />
    </main>
  );
}
