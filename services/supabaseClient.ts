
import { createClient } from '@supabase/supabase-js';


// -----------------------------------------------------------------------------
// IMPORTANT: REPLACE THE VALUES BELOW WITH YOUR SUPABASE PROJECT DETAILS
// -----------------------------------------------------------------------------
// You can find these in your Supabase project settings -> API
const supabaseUrl = 'https://slzobtfyujxtnphckuhd.supabase.co'; // e.g. 'https://xyz.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsem9idGZ5dWp4dG5waGNrdWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NjUyMTQsImV4cCI6MjA3NDE0MTIxNH0.jP8dObOF2gLiiy02iy8bNsf1TeRM8ygt6Dx5EUm2w0c'; // e.g. 'eyJhbGciOi...'
// -----------------------------------------------------------------------------


// if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_URL') {
//     console.error("Supabase URL is not set. Please update services/supabaseClient.ts");
// }
// if (!supabaseAnonKey || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY') {
//     console.error("Supabase Anon Key is not set. Please update services/supabaseClient.ts");
// }

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
