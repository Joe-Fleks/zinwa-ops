import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  is_active: boolean;
  force_password_reset: boolean;
  must_change_password: boolean;
  created_by: string | null;
  last_login_at: string | null;
  profile_picture_url: string | null;
  contact_number_1: string | null;
  contact_number_2: string | null;
  tagline: string | null;
}
