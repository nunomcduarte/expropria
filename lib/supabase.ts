import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigurado = Boolean(url && key);

export const supabase: SupabaseClient = createClient(
  url || "http://localhost:54321",
  key || "sem-chave"
);
