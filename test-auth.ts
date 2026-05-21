/**
 * Script de teste da autenticação do Supabase
 * Rode: npx ts-node test-auth.ts
 */

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = "https://orxzpykvlxwizfnrxukw.supabase.co";
const supabaseAnonKey = "sb_publishable_DsPILTgwymk_o6B30w42WA_jWotIHqN";

console.log("🔧 Testando autenticação Supabase...\n");
console.log("URL:", supabaseUrl);
console.log("Key:", supabaseAnonKey.slice(0, 20) + "...\n");

const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Teste 1: Verificar conexão
console.log("✅ Cliente Supabase criado com sucesso");

// Teste 2: Verificar sessão atual
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error("❌ Erro ao buscar sessão:", error);
  } else {
    console.log("📋 Sessão atual:", data.session?.user?.email ?? "nenhuma");
  }
});

export {};
