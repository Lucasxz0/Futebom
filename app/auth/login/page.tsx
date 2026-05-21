"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { translateAuthError } from "@/lib/utils";
import Button from "@/components/ui/Button";

// Inner component that uses useSearchParams — must be wrapped in <Suspense>
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    console.log("📝 Submetendo login para:", email);

    const { error } = await signIn(email, password);

    if (error) {
      console.error("❌ Erro completo:", error);
      console.error("❌ Mensagem do erro:", error?.message);
      const errorMsg = error?.message || "Erro desconhecido ao fazer login";
      setError(translateAuthError(errorMsg));
      setLoading(false);
      return;
    }

    console.log("✅ Login bem-sucedido! Redirecionando para:", redirectTo);
    router.replace(redirectTo);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Email */}
      <div>
        <label
          htmlFor="login-email"
          className="text-[#94A3B8] text-sm font-medium block mb-1.5"
        >
          Email
        </label>
        <div className="relative">
          <Mail
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]"
          />
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            autoComplete="email"
            className="w-full h-[48px] pl-9 pr-4 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F1F5F9] placeholder-[#64748B] text-sm focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-colors"
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <label
          htmlFor="login-password"
          className="text-[#94A3B8] text-sm font-medium block mb-1.5"
        >
          Senha
        </label>
        <div className="relative">
          <Lock
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]"
          />
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className="w-full h-[48px] pl-9 pr-4 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F1F5F9] placeholder-[#64748B] text-sm focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-colors"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          id="login-error"
          className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30"
          role="alert"
        >
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Submit */}
      <Button
        id="btn-login"
        type="submit"
        variant="primary"
        className="w-full mt-2"
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            Entrando...
          </span>
        ) : (
          "Entrar"
        )}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#0F172A] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-3">⚽</div>
        <h1 className="text-white text-3xl font-black font-display tracking-wide">
          FUTEBOM APP
        </h1>
        <p className="text-[#64748B] text-sm mt-1">Gerencie suas peladas</p>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{
          background: "rgba(30, 41, 59, 0.8)",
          border: "1px solid #334155",
          backdropFilter: "blur(12px)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        }}
      >
        <h2 className="text-[#F1F5F9] text-xl font-bold font-display mb-5">
          Entrar
        </h2>

        {/* Suspense required for useSearchParams in static build */}
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="skeleton h-[48px] rounded-xl" />
              <div className="skeleton h-[48px] rounded-xl" />
              <div className="skeleton h-[44px] rounded-xl" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        <p className="text-center text-[#64748B] text-sm mt-5">
          Não tem conta?{" "}
          <Link
            href="/auth/register"
            className="text-[#3B82F6] font-medium hover:underline"
          >
            Cadastrar
          </Link>
        </p>
      </div>
    </div>
  );
}
