import { createClient } from '@supabase/supabase-js';

// Supabase configuration - Updated to new project: laawwww22
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sehsfxueebydlhwlhncp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlaHNmeHVlZWJ5ZGxod2xobmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MzgyMDEsImV4cCI6MjA4NTExNDIwMX0.vpP42cOslkRv5OAVov8oQjHYJyRcSyAxIJlY9Z4vmL4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export interface User {
  id: string;
  email: string;
  is_admin: boolean;
  is_approved: boolean;
  created_at: string;
}

