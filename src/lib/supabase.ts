import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Env vars:", {
    url: import.meta.env.VITE_SUPABASE_URL,
    key: import.meta.env.VITE_SUPABASE_ANON_KEY,
  });
  throw new Error("Supabase URL und Anon Key müssen in .env definiert sein");
}

// Supabase-Client ohne Authentifizierung
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
