import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
  const missing = [
    !supabaseUrl ? "SUPABASE_URL" : null,
    !supabaseKey ? "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)" : null
  ].filter(Boolean);
  throw new Error(`Missing required environment variables for Supabase: ${missing.join(", ")}`);
}

export const supabase = createClient(supabaseUrl, supabaseKey);
