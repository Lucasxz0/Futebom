import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = "https://orxzpykvlxwizfnrxukw.supabase.co";
const supabaseAnonKey = "sb_publishable_DsPILTgwymk_o6B30w42WA_jWotIHqN";

const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

async function checkGroups() {
  const { data: groups, error } = await supabase.from("groups").select("*");
  if (error) {
    console.error("Error fetching groups:", error.message);
  } else {
    console.log("👥 Total groups in DB:", groups.length);
    console.log(groups);
  }
}

checkGroups();
