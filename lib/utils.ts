/**
 * General utility functions for Pelada App
 */

/**
 * Formats a number to always show two digits (e.g. 5 → "05")
 */
export function padTwo(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Formats seconds into MM:SS string
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${padTwo(m)}:${padTwo(s)}`;
}

/**
 * Generates a random alphanumeric access code (uppercase, N chars)
 */
export function generateAccessCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

/**
 * Returns user-facing error message from Supabase error object
 */
export function getErrorMessage(error: unknown): string {
  if (!error) return "Erro desconhecido";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "Erro desconhecido";
}

/**
 * Translates common Supabase auth error codes to Portuguese
 */
export function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "Email ou senha incorretos.",
    "Email not confirmed": "Confirme seu email antes de entrar.",
    "User already registered": "Este email já está cadastrado.",
    "Password should be at least 6 characters":
      "A senha deve ter pelo menos 6 caracteres.",
    "Unable to validate email address: invalid format":
      "Formato de email inválido.",
  };
  return map[message] ?? message;
}
