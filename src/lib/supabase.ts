// src/lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// กันสร้างซ้ำ (เก็บไว้บน globalThis)
declare global {
  // eslint-disable-next-line no-var
  var __supabase__: SupabaseClient | undefined;
}

export const supabase: SupabaseClient =
  globalThis.__supabase__ ??
  createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      storageKey: "device_mgmt_auth", // ตั้งชื่อคีย์ชัดเจน กันชนกันโปรเจกต์อื่น
      autoRefreshToken: true,
    },
  });

if (!globalThis.__supabase__) {
  globalThis.__supabase__ = supabase;
}
