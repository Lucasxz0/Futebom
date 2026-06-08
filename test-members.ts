import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = "https://orxzpykvlxwizfnrxukw.supabase.co";
const supabaseAnonKey = "sb_publishable_DsPILTgwymk_o6B30w42WA_jWotIHqN";

const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

async function checkMembers() {
  const { data: members, error } = await supabase.from("group_members").select("*");
  if (error) {
    console.error("Error fetching group_members:", error.message);
  } else {
    console.log("👥 Total members in DB:", members.length);
    console.log(members);
  }
}

checkMembers();
