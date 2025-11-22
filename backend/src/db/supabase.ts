import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  const missing = [
    !supabaseUrl ? "SUPABASE_URL" : null,
    !supabaseKey ? "SUPABASE_ANON_KEY" : null
  ].filter(Boolean);
  throw new Error(`Missing required environment variables for Supabase: ${missing.join(", ")}`);
}

export const supabase = createClient(supabaseUrl, supabaseKey);
