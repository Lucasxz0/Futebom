import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Browser client — use in Client Components ("use client")
 * Does NOT import next/headers, safe to bundle on the client
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
