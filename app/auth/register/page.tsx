"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, Loader2, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { translateAuthError } from "@/lib/utils";
import Button from "@/components/ui/Button";

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (!name.trim() || name.trim().length < 2) {
      return "Nome deve ter pelo menos 2 caracteres.";
    }
    if (!email.includes("@")) {
      return "Informe um email válido.";
    }
    if (password.length < 6) {
      return "A senha deve ter pelo menos 6 caracteres.";
    }
    if (password !== confirmPassword) {
      return "As senhas não coincidem.";
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, name.trim());
    setLoading(false);

    if (error) {
      setError(translateAuthError(error.message));
      return;
    }

    setSuccess(true);
    // Small delay to show success, then redirect
    setTimeout(() => {
      router.replace("/dashboard");
    }, 1500);
  }

  if (success) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#0F172A] flex flex-col items-center justify-center px-4">
        <div className="text-center animate-bounce-in">
          <CheckCircle size={64} className="text-[#22C55E] mx-auto mb-4" />
          <h2 className="text-white text-2xl font-bold font-display">Bem-vindo!</h2>
          <p className="text-[#94A3B8] text-sm mt-2">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#0F172A] flex flex-col items-center justify-center px-4 py-8">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-3">⚽</div>
        <h1 className="text-white text-3xl font-black font-display tracking-wide">
          FUTEBOM APP
        </h1>
        <p className="text-[#64748B] text-sm mt-1">Crie sua conta gratuita</p>
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
          Criar Conta
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Nome */}
          <div>
            <label
              htmlFor="register-name"
              className="text-[#94A3B8] text-sm font-medium block mb-1.5"
            >
              Seu nome
            </label>
            <div className="relative">
              <User
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]"
              />
              <input
                id="register-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="João Silva"
                required
                autoComplete="name"
                className="w-full h-[48px] pl-9 pr-4 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F1F5F9] placeholder-[#64748B] text-sm focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-colors"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="register-email"
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
                id="register-email"
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

          {/* Senha */}
          <div>
            <label
              htmlFor="register-password"
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
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                autoComplete="new-password"
                className="w-full h-[48px] pl-9 pr-4 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F1F5F9] placeholder-[#64748B] text-sm focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-colors"
              />
            </div>
          </div>

          {/* Confirmar Senha */}
          <div>
            <label
              htmlFor="register-confirm-password"
              className="text-[#94A3B8] text-sm font-medium block mb-1.5"
            >
              Confirmar Senha
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]"
              />
              <input
                id="register-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                required
                autoComplete="new-password"
                className="w-full h-[48px] pl-9 pr-4 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F1F5F9] placeholder-[#64748B] text-sm focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-colors"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              id="register-error"
              className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30"
              role="alert"
            >
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          {/* Submit */}
          <Button
            id="btn-register"
            type="submit"
            variant="primary"
            className="w-full mt-2"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Criando conta...
              </span>
            ) : (
              "Criar Conta"
            )}
          </Button>
        </form>

        <p className="text-center text-[#64748B] text-sm mt-5">
          Já tem conta?{" "}
          <Link
            href="/auth/login"
            className="text-[#3B82F6] font-medium hover:underline"
          >
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
