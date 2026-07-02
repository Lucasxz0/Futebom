const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://orxzpykvlxwizfnrxukw.supabase.co";
const supabaseAnonKey = "sb_publishable_DsPILTgwymk_o6B30w42WA_jWotIHqN";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("🔍 Verificando estrutura do banco de dados...");
  
  // Tentar selecionar group_id especificamente
  const { data, error } = await supabase.from('players').select('group_id').limit(1);
  
  if (error) {
    console.error("❌ Erro ao buscar coluna 'group_id' na tabela 'players':", error.message);
    console.log("\n💡 Isso geralmente significa que a migração não foi aplicada ou ocorreu algum erro.");
  } else {
    console.log("✅ Sucesso! A coluna 'group_id' existe na tabela 'players'!");
  }
}

run();
