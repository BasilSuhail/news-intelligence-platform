import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fsSync from 'fs';
import path from 'path';

// Load environment variables from .env file
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (fsSync.existsSync(envPath)) {
    const envContent = fsSync.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        const value = valueParts.join("=");
        if (key && value && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}
loadEnv();

// Use the correct env variable names from .env
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

// Create Supabase client for server-side operations
export const supabase: SupabaseClient | null = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

// Log configuration status on import
if (supabase) {
  console.log('Supabase configured successfully');
} else {
  console.warn('Supabase not configured - SUPABASE_URL or SUPABASE_ANON_KEY missing');
}
