import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tfilijyzvjnsbltqyono.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmaWxpanl6dmpuc2JsdHF5b25vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzkzODgsImV4cCI6MjA4NDkxNTM4OH0.vtFEyx67G4SXRFzBdTqS2AMF5-cPC4-ZiYtbkWyKSxA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export interface User {
  id: string;
  email: string;
  is_admin: boolean;
  is_approved: boolean;
  created_at: string;
}

