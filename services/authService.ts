import { supabase } from './supabaseClient';
import { User } from '../types';

export const authService = {
  // Get the current user from the session, including their role from the 'profiles' table
  getUser: async (): Promise<User | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    // Fetch the user's profile to get their role
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error("Error fetching user profile:", error);
        // Fallback to default user role if profile is missing
        return { email: session.user.email!, role: 'user' };
    }
    
    return {
        email: session.user.email!,
        role: profile?.role || 'user',
    };
  },

  // Listen for authentication state changes
  onAuthStateChange: (callback: (user: User | null) => void) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const userWithProfile = await authService.getUser();
        callback(userWithProfile);
      } else {
        callback(null);
      }
    });

    return subscription;
  },

  login: async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) throw error;
  },

  register: async (email: string, pass: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
    });
    if (error) throw error;
    if (!data.user) throw new Error("Registration failed: No user returned.");
    // The onAuthStateChange listener will handle fetching the profile.
    return data.user;
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};