import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = "https://orxzpykvlxwizfnrxukw.supabase.co";
const supabaseAnonKey = "sb_publishable_DsPILTgwymk_o6B30w42WA_jWotIHqN";

const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

async function inspectAdmins() {
  console.log("🔍 Inspecionando app_admins e usuários...");
  
  // 1. Verificar registros em app_admins
  const { data: admins, error: adminError } = await supabase
    .from("app_admins")
    .select("*");
    
  if (adminError) {
    console.error("❌ Erro ao ler app_admins:", adminError.message);
  } else {
    console.log("👥 Registros em app_admins:", admins);
  }

  // 2. Verificar se o e-mail melo97775@gmail.com existe nos auth.users
  // Nota: Não temos acesso à tabela auth.users pelo cliente anon por RLS,
  // mas podemos tentar fazer uma busca indireta ou apenas reportar.
}

inspectAdmins();
